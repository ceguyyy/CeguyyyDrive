const orgDriveRepository = require('../repositories/orgDriveRepository');
const cosService = require('./cosService');
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

    async generateUploadUrl(orgId, originalName, size, mimeType, folderId, userId) {
        if (!folderId) {
            throw new AppError('File must be uploaded inside a role folder', 400);
        }
        const manageableRoleIds = await this.getManageableRoleIds(orgId, userId);
        const hasAccess = await orgDriveRepository.verifyFolderAccess(orgId, folderId, manageableRoleIds);
        if (!hasAccess) {
            throw new AppError('Access denied to destination folder', 403);
        }

        const objectKey = cosService.generateObjectKey(userId, originalName);
        const file = await orgDriveRepository.createFileRecord(orgId, originalName, size, mimeType, objectKey, folderId, userId, manageableRoleIds);
        const uploadUrl = await cosService.getPresignedUploadUrl(objectKey, mimeType);

        return { file, uploadUrl, objectKey };
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
