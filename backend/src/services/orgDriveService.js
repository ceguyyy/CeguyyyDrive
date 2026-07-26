const orgDriveRepository = require('../repositories/orgDriveRepository');
const cosService = require('./cosService');
const fileService = require('./fileService');
const organizationRepository = require('../repositories/organizationRepository');
const db = require('../config/db');
const AppError = require('../utils/AppError');

class OrgDriveService {
    async getManageableRoleIds(orgId, userId) {
        return await orgDriveRepository.getManageableRoleIds(orgId, userId);
    }

    async listDriveContents(orgId, folderId, userId) {
        const manageableRoleIds = await this.getManageableRoleIds(orgId, userId);
        const contents = await orgDriveRepository.listDriveContents(orgId, folderId, manageableRoleIds);
        if (!contents) {
            throw new AppError('Folder not found or access denied', 403);
        }
        return contents;
    }

    async createSubfolder(orgId, name, parentFolderId, userId) {
        if (!parentFolderId) {
            throw new AppError('Subfolder must be created inside a role folder', 400);
        }
        const manageableRoleIds = await this.getManageableRoleIds(orgId, userId);
        const folder = await orgDriveRepository.createSubfolder(orgId, name, parentFolderId, userId, manageableRoleIds);
        if (!folder) {
            throw new AppError('Failed to create subfolder or access denied', 403);
        }
        return folder;
    }

    // Every path that adds bytes to an organization must run this: direct
    // upload and cross-drive copy alike. Keeping it in one place is what stops
    // a new write path from silently bypassing the quotas.
    async assertCanAddBytes(orgId, userId, folderId, size) {
        const manageableRoleIds = await this.getManageableRoleIds(orgId, userId);
        const hasAccess = await orgDriveRepository.verifyFolderAccess(orgId, folderId, manageableRoleIds);
        if (!hasAccess) {
            throw new AppError('Access denied to destination folder', 403);
        }

        const org = await organizationRepository.findOrganizationById(orgId);
        if (!org) throw new AppError('Organization not found', 404);
        if (org.status === 'suspended') {
            throw new AppError('Cannot upload files. This organization has been suspended by the Billing Administrator.', 403);
        }

        // Total organization quota
        const orgUsedRes = await db.query(
            `SELECT COALESCE(SUM(f.size), 0)::bigint as total_used FROM files f JOIN folders fld ON f.folder_id = fld.id WHERE fld.organization_id = $1 AND f.is_deleted = false`,
            [orgId]
        );
        const orgUsed = parseInt(orgUsedRes.rows[0].total_used, 10) || 0;
        if (org.storage_limit_bytes && (orgUsed + size) > parseInt(org.storage_limit_bytes, 10)) {
            const limitGB = (parseInt(org.storage_limit_bytes, 10) / (1024 * 1024 * 1024)).toFixed(2);
            throw new AppError(`Upload failed: Organization storage quota (${limitGB} GB) exceeded.`, 403);
        }

        // Role quota
        const ownerRoleId = await orgDriveRepository.getNearestOwnerRoleId(folderId);
        if (ownerRoleId) {
            const roleRes = await db.query(`SELECT name, storage_limit FROM organization_roles WHERE id = $1`, [ownerRoleId]);
            if (roleRes.rows.length > 0) {
                const role = roleRes.rows[0];
                const roleLimit = parseInt(role.storage_limit || 0, 10);
                if (roleLimit > 0) {
                    const roleUsedRes = await db.query(
                        `SELECT COALESCE(SUM(f.size), 0)::bigint as role_used FROM files f JOIN folders fld ON f.folder_id = fld.id WHERE fld.owner_role_id = $1 AND f.is_deleted = false`,
                        [ownerRoleId]
                    );
                    const roleUsed = parseInt(roleUsedRes.rows[0].role_used, 10) || 0;
                    if ((roleUsed + size) > roleLimit) {
                        const roleGB = (roleLimit / (1024 * 1024 * 1024)).toFixed(2);
                        throw new AppError(`Upload failed: Storage quota (${roleGB} GB) exceeded for role "${role.name}".`, 403);
                    }
                }
            }
        }

        // Per-member quota
        const memberRes = await db.query(
            `SELECT role_name, storage_limit FROM organization_members WHERE organization_id = $1 AND (user_id = $2 OR LOWER(email) = (SELECT LOWER(email) FROM users WHERE id = $2))`,
            [orgId, userId]
        );
        if (memberRes.rows.length > 0) {
            const member = memberRes.rows[0];
            const fallbackLimit = member.role_name === 'Owner' ? 0 : (org.member_storage_limit_bytes || 0);
            const memberLimit = parseInt(member.storage_limit || fallbackLimit, 10);
            if (memberLimit > 0) {
                const memberUsedRes = await db.query(
                    `SELECT COALESCE(SUM(f.size), 0)::bigint as member_used FROM files f JOIN folders fld ON f.folder_id = fld.id WHERE fld.organization_id = $1 AND f.user_id = $2 AND f.is_deleted = false`,
                    [orgId, userId]
                );
                const memberUsed = parseInt(memberUsedRes.rows[0].member_used, 10) || 0;
                if ((memberUsed + size) > memberLimit) {
                    const memberGB = (memberLimit / (1024 * 1024 * 1024)).toFixed(2);
                    throw new AppError(`Upload failed: Per-member storage quota (${memberGB} GB) exceeded.`, 403);
                }
            }
        }

        return { org, manageableRoleIds };
    }

    async generateUploadUrl(orgId, originalName, size, mimeType, folderId, userId) {
        if (!folderId) {
            throw new AppError('File must be uploaded inside a role folder', 400);
        }
        const { manageableRoleIds } = await this.assertCanAddBytes(orgId, userId, folderId, size);

        const objectKey = cosService.generateObjectKey(userId, originalName);
        const file = await orgDriveRepository.createFileRecord(orgId, originalName, size, mimeType, objectKey, folderId, userId, manageableRoleIds);
        const uploadUrl = await cosService.getPresignedUploadUrl(objectKey, mimeType);

        return { file, uploadUrl, objectKey };
    }

    // My Drive -> Company Drive. Copies the stored object server-side, so no
    // re-upload and no bandwidth cost.
    async copyPersonalFileToOrg(orgId, userId, fileId, destinationFolderId) {
        if (!destinationFolderId) {
            throw new AppError('Choose a destination folder in the Company Drive', 400);
        }

        // Source must be a personal file this user can actually read.
        const source = await fileService.getAccessibleFile(fileId, userId);
        if (source.organization_id) {
            throw new AppError('That file already belongs to a Company Drive', 400);
        }

        const size = parseInt(source.size, 10) || 0;
        const { manageableRoleIds } = await this.assertCanAddBytes(orgId, userId, destinationFolderId, size);

        const newKey = cosService.generateObjectKey(userId, source.original_name);
        await cosService.copyObject(source.storage_key, newKey);

        const file = await orgDriveRepository.createFileRecord(
            orgId, source.original_name, size, source.mime_type,
            newKey, destinationFolderId, userId, manageableRoleIds
        );
        if (!file) {
            throw new AppError('Failed to create the copy in the Company Drive', 403);
        }
        return file;
    }

    // Company Drive -> My Drive. fileService.createFileRecord enforces the
    // personal storage quota and de-duplicates the filename.
    async copyOrgFileToPersonal(orgId, userId, fileId, destinationFolderId = null) {
        const manageableRoleIds = await this.getManageableRoleIds(orgId, userId);
        const source = await orgDriveRepository.getFile(fileId);
        if (!source || source.organization_id !== orgId) {
            throw new AppError('File not found', 404);
        }

        const hasAccess = await orgDriveRepository.verifyFolderAccess(orgId, source.folder_id, manageableRoleIds);
        if (!hasAccess) {
            throw new AppError('Access denied', 403);
        }

        const newKey = cosService.generateObjectKey(userId, source.original_name);
        await cosService.copyObject(source.storage_key, newKey);

        return await fileService.createFileRecord(
            source.original_name,
            parseInt(source.size, 10) || 0,
            source.mime_type,
            newKey,
            destinationFolderId,
            userId
        );
    }

    async generateDownloadUrl(orgId, fileId, userId) {
        const manageableRoleIds = await this.getManageableRoleIds(orgId, userId);
        const file = await orgDriveRepository.getFile(fileId);
        if (!file || file.organization_id !== orgId) {
            throw new AppError('File not found', 404);
        }

        const hasAccess = await orgDriveRepository.verifyFolderAccess(orgId, file.folder_id, manageableRoleIds);
        if (!hasAccess) {
            throw new AppError('Access denied', 403);
        }

        const downloadUrl = await cosService.getPresignedDownloadUrl(file.storage_key, true, file.mime_type);
        return { downloadUrl, file };
    }

    async renameFolder(orgId, folderId, newName, userId) {
        const manageableRoleIds = await this.getManageableRoleIds(orgId, userId);
        const folder = await orgDriveRepository.renameFolder(orgId, folderId, newName, manageableRoleIds);
        if (!folder) {
            throw new AppError('Folder cannot be renamed or access denied', 403);
        }
        return folder;
    }

    async renameFile(orgId, fileId, newName, userId) {
        const manageableRoleIds = await this.getManageableRoleIds(orgId, userId);
        const file = await orgDriveRepository.renameFile(orgId, fileId, newName, manageableRoleIds);
        if (!file) {
            throw new AppError('File cannot be renamed or access denied', 403);
        }
        return file;
    }

    async softDeleteFolder(orgId, folderId, userId) {
        const manageableRoleIds = await this.getManageableRoleIds(orgId, userId);
        const folder = await orgDriveRepository.softDeleteFolder(orgId, folderId, manageableRoleIds);
        if (!folder) {
            throw new AppError('Folder cannot be deleted or access denied', 403);
        }
        return folder;
    }

    async softDeleteFile(orgId, fileId, userId) {
        const manageableRoleIds = await this.getManageableRoleIds(orgId, userId);
        const file = await orgDriveRepository.softDeleteFile(orgId, fileId, manageableRoleIds);
        if (!file) {
            throw new AppError('File cannot be deleted or access denied', 403);
        }
        return file;
    }

    async getTrashedItems(orgId, userId) {
        const manageableRoleIds = await this.getManageableRoleIds(orgId, userId);
        return await orgDriveRepository.getTrashedItems(orgId, manageableRoleIds);
    }

    async restoreItem(orgId, type, id, userId) {
        const manageableRoleIds = await this.getManageableRoleIds(orgId, userId);
        const item = await orgDriveRepository.restoreItem(orgId, type, id, manageableRoleIds);
        if (!item) {
            throw new AppError('Failed to restore item or access denied', 403);
        }
        return item;
    }
}

module.exports = new OrgDriveService();
