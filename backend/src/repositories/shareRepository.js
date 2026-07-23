const db = require('../config/db');

class ShareRepository {
    async create(token, fileId, folderId, createdBy, expiresAt, passwordHash) {
        const result = await db.query(
            `INSERT INTO shares (token, file_id, folder_id, created_by, expires_at, password_hash) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [token, fileId, folderId, createdBy, expiresAt, passwordHash]
        );
        return result.rows[0];
    }

    async findByToken(token) {
        const result = await db.query(
            `SELECT * FROM shares WHERE token = $1`,
            [token]
        );
        return result.rows[0];
    }

    async findByResourceAndUser(fileId, folderId, userId) {
        let query = `SELECT * FROM shares WHERE created_by = $1 AND `;
        const params = [userId];

        if (fileId) {
            query += `file_id = $2`;
            params.push(fileId);
        } else if (folderId) {
            query += `folder_id = $2`;
            params.push(folderId);
        } else {
            return [];
        }

        const result = await db.query(query, params);
        return result.rows;
    }

    async delete(id, userId) {
        const result = await db.query(
            `DELETE FROM shares WHERE id = $1 AND created_by = $2 RETURNING *`,
            [id, userId]
        );
        return result.rows[0];
    }
}

module.exports = new ShareRepository();
