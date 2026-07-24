const db = require('../config/db');

class ShareRepository {
    async create(token, fileId, folderId, sharedBy, expiresAt, passwordHash, sharedWith = null) {
        const result = await db.query(
            `INSERT INTO shares (token, file_id, folder_id, shared_by, expires_at, password_hash, shared_with) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [token, fileId, folderId, sharedBy, expiresAt, passwordHash, sharedWith]
        );
        return result.rows[0];
    }

    async findByToken(token) {
        const result = await db.query(
            `SELECT * FROM shares WHERE token = $1 OR id::text = $1`,
            [token]
        );
        return result.rows[0];
    }

    async findByResourceAndUser(fileId, folderId, userId) {
        let query = `SELECT s.*, u.full_name as shared_with_name, u.email as shared_with_email 
                     FROM shares s 
                     LEFT JOIN users u ON s.shared_with = u.id 
                     WHERE s.shared_by = $1 AND `;
        const params = [userId];

        if (fileId) {
            query += `s.file_id = $2`;
            params.push(fileId);
        } else if (folderId) {
            query += `s.folder_id = $2`;
            params.push(folderId);
        } else {
            return [];
        }

        const result = await db.query(query, params);
        return result.rows;
    }

    async findReceivedShares(userId) {
        const result = await db.query(
            `SELECT s.*, 
                    u.full_name as owner_name, u.email as owner_email,
                    f.original_name as file_name, f.mime_type, f.size, f.storage_key,
                    fd.name as folder_name
             FROM shares s
             JOIN users u ON s.shared_by = u.id
             LEFT JOIN files f ON s.file_id = f.id AND f.is_deleted = false
             LEFT JOIN folders fd ON s.folder_id = fd.id AND fd.is_deleted = false
             WHERE s.shared_with = $1
             ORDER BY s.created_at DESC`,
            [userId]
        );
        return result.rows;
    }

    async findSentShares(userId) {
        const result = await db.query(
            `SELECT s.*, 
                    u.full_name as recipient_name, u.email as recipient_email,
                    f.original_name as file_name, f.mime_type, f.size,
                    fd.name as folder_name
             FROM shares s
             LEFT JOIN users u ON s.shared_with = u.id
             LEFT JOIN files f ON s.file_id = f.id AND f.is_deleted = false
             LEFT JOIN folders fd ON s.folder_id = fd.id AND fd.is_deleted = false
             WHERE s.shared_by = $1
             ORDER BY s.created_at DESC`,
            [userId]
        );
        return result.rows;
    }

    async delete(id, userId) {
        const result = await db.query(
            `DELETE FROM shares WHERE id = $1 AND shared_by = $2 RETURNING *`,
            [id, userId]
        );
        return result.rows[0];
    }

    async deleteByRecipient(id, recipientUserId) {
        const result = await db.query(
            `DELETE FROM shares WHERE id = $1 AND shared_with = $2 RETURNING *`,
            [id, recipientUserId]
        );
        return result.rows[0];
    }
}

module.exports = new ShareRepository();
