const db = require('../config/db');

class OrgDriveRepository {
    async getManageableRoleIds(orgId, userId) {
        // First check if user is the organization owner
        const orgRes = await db.query(`SELECT owner_id FROM organizations WHERE id = $1`, [orgId]);
        if (orgRes.rows.length > 0 && orgRes.rows[0].owner_id === userId) {
            // Organization Owner manages all roles in the organization
            const allRolesRes = await db.query(
                `SELECT id FROM organization_roles WHERE organization_id = $1`,
                [orgId]
            );
            return allRolesRes.rows.map(r => r.id);
        }

        // For non-owner members: find member role and all descendant roles
        const memberRes = await db.query(
            `SELECT role_name FROM organization_members 
             WHERE organization_id = $1 AND user_id = $2 AND status = 'accepted'`,
            [orgId, userId]
        );
        if (memberRes.rows.length === 0 || !memberRes.rows[0].role_name) return [];

        const roleRes = await db.query(
            `SELECT id FROM organization_roles WHERE organization_id = $1 AND LOWER(name) = LOWER($2)`,
            [orgId, memberRes.rows[0].role_name]
        );
        if (roleRes.rows.length === 0) return [];
        const userRoleId = roleRes.rows[0].id;

        const result = await db.query(
            `WITH RECURSIVE role_tree AS (
                SELECT id FROM organization_roles WHERE id = $1 AND organization_id = $2
                UNION ALL
                SELECT r.id FROM organization_roles r
                JOIN role_tree rt ON r.parent_role_id = rt.id
             )
             SELECT id FROM role_tree`,
            [userRoleId, orgId]
        );
        return result.rows.map(r => r.id);
    }

    async getNearestOwnerRoleId(folderId) {
        const result = await db.query(
            `WITH RECURSIVE folder_tree AS (
                SELECT id, parent_id, owner_role_id FROM folders WHERE id = $1
                UNION ALL
                SELECT f.id, f.parent_id, f.owner_role_id FROM folders f
                JOIN folder_tree ft ON f.id = ft.parent_id
             )
             SELECT owner_role_id FROM folder_tree WHERE owner_role_id IS NOT NULL LIMIT 1`,
            [folderId]
        );
        return result.rows.length > 0 ? result.rows[0].owner_role_id : null;
    }

    async verifyFolderAccess(orgId, folderId, manageableRoleIds) {
        if (!folderId) return true;
        const ownerRoleId = await this.getNearestOwnerRoleId(folderId);
        if (!ownerRoleId) return false;
        return manageableRoleIds.includes(ownerRoleId);
    }

    async getFolder(folderId) {
        const res = await db.query(`SELECT * FROM folders WHERE id = $1`, [folderId]);
        return res.rows[0];
    }

    async getFile(fileId) {
        const res = await db.query(`SELECT * FROM files WHERE id = $1`, [fileId]);
        return res.rows[0];
    }

    async listDriveContents(orgId, folderId, manageableRoleIds) {
        if (!folderId) {
            // Root level: return role root folders manageable by the user
            if (!manageableRoleIds || manageableRoleIds.length === 0) return { folders: [], files: [] };

            let foldersRes = await db.query(
                `SELECT * FROM folders 
                 WHERE organization_id = $1 AND parent_id IS NULL AND is_deleted = false 
                   AND owner_role_id = ANY($2)
                 ORDER BY name ASC`,
                [orgId, manageableRoleIds]
            );

            // Fallback: If no role root folders exist for this org, provision them now
            if (foldersRes.rows.length === 0) {
                const rolesRes = await db.query(`SELECT id, name FROM organization_roles WHERE organization_id = $1`, [orgId]);
                for (const role of rolesRes.rows) {
                    await db.query(
                        `INSERT INTO folders (name, organization_id, owner_role_id, user_id)
                         VALUES ($1, $2, $3, NULL)
                         ON CONFLICT DO NOTHING`,
                        [role.name, orgId, role.id]
                    );
                }

                foldersRes = await db.query(
                    `SELECT * FROM folders 
                     WHERE organization_id = $1 AND parent_id IS NULL AND is_deleted = false 
                       AND owner_role_id = ANY($2)
                     ORDER BY name ASC`,
                    [orgId, manageableRoleIds]
                );
            }

            return { folders: foldersRes.rows, files: [] };
        }

        // Subfolder level: check permission first
        const hasAccess = await this.verifyFolderAccess(orgId, folderId, manageableRoleIds);
        if (!hasAccess) return null;

        const foldersRes = await db.query(
            `SELECT * FROM folders 
             WHERE organization_id = $1 AND parent_id = $2 AND is_deleted = false 
             ORDER BY name ASC`,
            [orgId, folderId]
        );

        const filesRes = await db.query(
            `SELECT f.*, u.full_name as uploader_name 
             FROM files f 
             LEFT JOIN users u ON f.user_id = u.id 
             WHERE f.organization_id = $1 AND f.folder_id = $2 AND f.is_deleted = false 
             ORDER BY f.original_name ASC`,
            [orgId, folderId]
        );

        return { folders: foldersRes.rows, files: filesRes.rows };
    }

    async createSubfolder(orgId, name, parentFolderId, userId, manageableRoleIds) {
        const hasAccess = await this.verifyFolderAccess(orgId, parentFolderId, manageableRoleIds);
        if (!hasAccess) return null;

        const res = await db.query(
            `INSERT INTO folders (name, organization_id, parent_id, user_id)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [name, orgId, parentFolderId, userId]
        );
        return res.rows[0];
    }

    async createFileRecord(orgId, originalName, size, mimeType, storageKey, folderId, userId, manageableRoleIds) {
        const hasAccess = await this.verifyFolderAccess(orgId, folderId, manageableRoleIds);
        if (!hasAccess) return null;

        const res = await db.query(
            `INSERT INTO files (original_name, size, mime_type, storage_key, folder_id, organization_id, user_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [originalName, size, mimeType, storageKey, folderId, orgId, userId]
        );
        return res.rows[0];
    }

    async renameFolder(orgId, folderId, newName, manageableRoleIds) {
        const folder = await this.getFolder(folderId);
        if (!folder || folder.owner_role_id) return null; // Root role folders cannot be renamed

        const hasAccess = await this.verifyFolderAccess(orgId, folderId, manageableRoleIds);
        if (!hasAccess) return null;

        const res = await db.query(
            `UPDATE folders SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
            [newName, folderId]
        );
        return res.rows[0];
    }

    async renameFile(orgId, fileId, newName, manageableRoleIds) {
        const file = await this.getFile(fileId);
        if (!file) return null;

        const hasAccess = await this.verifyFolderAccess(orgId, file.folder_id, manageableRoleIds);
        if (!hasAccess) return null;

        const res = await db.query(
            `UPDATE files SET original_name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
            [newName, fileId]
        );
        return res.rows[0];
    }

    async softDeleteFolder(orgId, folderId, manageableRoleIds) {
        const folder = await this.getFolder(folderId);
        if (!folder || folder.owner_role_id) return null; // Root role folders cannot be deleted

        const hasAccess = await this.verifyFolderAccess(orgId, folderId, manageableRoleIds);
        if (!hasAccess) return null;

        const res = await db.query(
            `UPDATE folders SET is_deleted = true WHERE id = $1 RETURNING *`,
            [folderId]
        );
        return res.rows[0];
    }

    async softDeleteFile(orgId, fileId, manageableRoleIds) {
        const file = await this.getFile(fileId);
        if (!file) return null;

        const hasAccess = await this.verifyFolderAccess(orgId, file.folder_id, manageableRoleIds);
        if (!hasAccess) return null;

        const res = await db.query(
            `UPDATE files SET is_deleted = true WHERE id = $1 RETURNING *`,
            [fileId]
        );
        return res.rows[0];
    }

    async getTrashedItems(orgId, manageableRoleIds) {
        if (manageableRoleIds.length === 0) return { folders: [], files: [] };

        const foldersRes = await db.query(
            `SELECT * FROM folders WHERE organization_id = $1 AND is_deleted = true ORDER BY name ASC`,
            [orgId]
        );

        const filesRes = await db.query(
            `SELECT f.*, u.full_name as uploader_name FROM files f
             LEFT JOIN users u ON f.user_id = u.id
             WHERE f.organization_id = $1 AND f.is_deleted = true ORDER BY f.original_name ASC`,
            [orgId]
        );

        // Filter trashed items to those whose root ancestor is in manageableRoleIds
        const validFolders = [];
        for (const fol of foldersRes.rows) {
            const hasAccess = await this.verifyFolderAccess(orgId, fol.id, manageableRoleIds);
            if (hasAccess) validFolders.push(fol);
        }

        const validFiles = [];
        for (const file of filesRes.rows) {
            const hasAccess = await this.verifyFolderAccess(orgId, file.folder_id, manageableRoleIds);
            if (hasAccess) validFiles.push(file);
        }

        return { folders: validFolders, files: validFiles };
    }

    async restoreItem(orgId, type, id, manageableRoleIds) {
        if (type === 'folder') {
            const hasAccess = await this.verifyFolderAccess(orgId, id, manageableRoleIds);
            if (!hasAccess) return null;
            const res = await db.query(`UPDATE folders SET is_deleted = false WHERE id = $1 RETURNING *`, [id]);
            return res.rows[0];
        } else {
            const file = await this.getFile(id);
            if (!file) return null;
            const hasAccess = await this.verifyFolderAccess(orgId, file.folder_id, manageableRoleIds);
            if (!hasAccess) return null;
            const res = await db.query(`UPDATE files SET is_deleted = false WHERE id = $1 RETURNING *`, [id]);
            return res.rows[0];
        }
    }
}

module.exports = new OrgDriveRepository();
