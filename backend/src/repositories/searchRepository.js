const db = require('../config/db');

class SearchRepository {
    async searchFiles(query, mimeType, userId) {
        let sql = `SELECT * FROM files WHERE user_id = $1 AND is_deleted = false`;
        const params = [userId];
        let paramIndex = 2;

        if (query) {
            sql += ` AND name ILIKE $${paramIndex}`;
            params.push(`%${query}%`);
            paramIndex++;
        }

        if (mimeType) {
            sql += ` AND mime_type ILIKE $${paramIndex}`;
            params.push(`%${mimeType}%`);
            paramIndex++;
        }

        sql += ` ORDER BY created_at DESC LIMIT 50`;

        const result = await db.query(sql, params);
        return result.rows;
    }

    async searchFolders(query, userId) {
        let sql = `SELECT * FROM folders WHERE user_id = $1 AND is_deleted = false`;
        const params = [userId];
        let paramIndex = 2;

        if (query) {
            sql += ` AND name ILIKE $${paramIndex}`;
            params.push(`%${query}%`);
            paramIndex++;
        }

        sql += ` ORDER BY created_at DESC LIMIT 50`;

        const result = await db.query(sql, params);
        return result.rows;
    }
}

module.exports = new SearchRepository();
