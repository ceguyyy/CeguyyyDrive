const db = require('../config/db');

class VersionRepository {
    async create(fileId, storageKey, size) {
        const result = await db.query(
            `INSERT INTO file_versions (file_id, storage_key, size) 
             VALUES ($1, $2, $3) RETURNING *`,
            [fileId, storageKey, size]
        );
        return result.rows[0];
    }

    async findByFileId(fileId) {
        const result = await db.query(
            `SELECT * FROM file_versions WHERE file_id = $1 ORDER BY created_at DESC`,
            [fileId]
        );
        return result.rows;
    }

    async findById(id) {
        const result = await db.query(
            `SELECT * FROM file_versions WHERE id = $1`,
            [id]
        );
        return result.rows[0];
    }

    async delete(id) {
        const result = await db.query(
            `DELETE FROM file_versions WHERE id = $1 RETURNING *`,
            [id]
        );
        return result.rows[0];
    }
}

module.exports = new VersionRepository();
