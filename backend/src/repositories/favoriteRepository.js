const db = require('../config/db');

class FavoriteRepository {
    async toggleStar(userId, fileId) {
        const existing = await db.query(
            `SELECT id FROM favorites WHERE user_id = $1 AND file_id = $2`,
            [userId, fileId]
        );

        if (existing.rows.length > 0) {
            await db.query(
                `DELETE FROM favorites WHERE user_id = $1 AND file_id = $2`,
                [userId, fileId]
            );
            return { starred: false };
        } else {
            await db.query(
                `INSERT INTO favorites (user_id, file_id) VALUES ($1, $2)`,
                [userId, fileId]
            );
            return { starred: true };
        }
    }

    async getStarredFiles(userId) {
        const result = await db.query(
            `SELECT f.*, true AS is_starred,
                    ar.id as approval_request_id, ar.title as approval_title, ar.status as approval_status
             FROM files f
             JOIN favorites fav ON f.id = fav.file_id
             LEFT JOIN LATERAL (
                 SELECT id, title, status
                 FROM approval_requests
                 WHERE file_id = f.id
                 ORDER BY created_at DESC
                 LIMIT 1
             ) ar ON true
             WHERE fav.user_id = $1 AND f.is_deleted = false
             ORDER BY fav.created_at DESC`,
            [userId]
        );
        return result.rows;
    }
}

module.exports = new FavoriteRepository();
