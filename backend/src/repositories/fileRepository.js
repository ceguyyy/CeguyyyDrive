const db = require('../config/db');

class FileRepository {
    async create(originalName, size, mimeType, storageKey, folderId, userId) {
        const result = await db.query(
            `INSERT INTO files (original_name, size, mime_type, storage_key, folder_id, user_id) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [originalName, size, mimeType, storageKey, folderId, userId]
        );
        return result.rows[0];
    }

    async findByIdAndUser(id, userId) {
        const result = await db.query(
            `SELECT * FROM files WHERE id = $1 AND user_id = $2 AND is_deleted = false`,
            [id, userId]
        );
        return result.rows[0];
    }

    async findAccessibleById(id, userId) {
        const result = await db.query(
            `SELECT f.* FROM files f
             LEFT JOIN shares s ON f.id = s.file_id
             WHERE f.id = $1 AND f.is_deleted = false
               AND (f.user_id = $2 OR s.shared_with = $2 OR s.is_public = true)
             LIMIT 1`,
            [id, userId]
        );
        return result.rows[0];
    }

    async findByNameAndFolder(name, folderId, userId) {
        let query = `SELECT * FROM files WHERE name = $1 AND user_id = $2 AND is_deleted = false `;
        const params = [name, userId];
        
        if (folderId) {
            query += `AND folder_id = $3`;
            params.push(folderId);
        } else {
            query += `AND folder_id IS NULL`;
        }

        const result = await db.query(query, params);
        return result.rows[0];
    }

    async findByFolderAndUser(folderId, userId) {
        let query = `
            SELECT f.*, ar.id as approval_request_id, ar.title as approval_title, ar.status as approval_status
            FROM files f
            LEFT JOIN LATERAL (
                SELECT id, title, status
                FROM approval_requests
                WHERE file_id = f.id
                ORDER BY created_at DESC
                LIMIT 1
            ) ar ON true
            WHERE f.user_id = $1 AND f.is_deleted = false `;
        const params = [userId];

        if (folderId) {
            query += `AND f.folder_id = $2`;
            params.push(folderId);
        } else {
            query += `AND f.folder_id IS NULL`;
        }

        query += ` ORDER BY f.original_name ASC`;

        const result = await db.query(query, params);
        return result.rows;
    }

    async update(id, userId, originalName, folderId) {
        let query = `UPDATE files SET updated_at = CURRENT_TIMESTAMP`;
        const params = [];
        let paramIdx = 1;

        if (originalName !== undefined && originalName !== null) {
            query += `, original_name = $${paramIdx}`;
            params.push(originalName);
            paramIdx++;
        }

        if (folderId !== undefined) {
            query += `, folder_id = $${paramIdx}`;
            params.push(folderId);
            paramIdx++;
        }

        query += ` WHERE id = $${paramIdx} AND user_id = $${paramIdx + 1} AND is_deleted = false RETURNING *`;
        params.push(id, userId);

        const result = await db.query(query, params);
        return result.rows[0];
    }

    async softDelete(id, userId) {
        const result = await db.query(
            `UPDATE files 
             SET is_deleted = true 
             WHERE id = $1 AND user_id = $2 
             RETURNING *`,
            [id, userId]
        );
        return result.rows[0];
    }

    async findTrashedByUser(userId) {
        const result = await db.query(
            `SELECT * FROM files WHERE user_id = $1 AND is_deleted = true`,
            [userId]
        );
        return result.rows;
    }

    async restore(id, userId) {
        const result = await db.query(
            `UPDATE files 
             SET is_deleted = false 
             WHERE id = $1 AND user_id = $2 
             RETURNING *`,
            [id, userId]
        );
        return result.rows[0];
    }

    async hardDelete(id, userId) {
        await db.query(
            `DELETE FROM files WHERE id = $1 AND user_id = $2`,
            [id, userId]
        );
    }
}

module.exports = new FileRepository();
