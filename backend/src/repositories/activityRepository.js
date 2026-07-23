const db = require('../config/db');

class ActivityRepository {
    async createLog(userId, action, targetType, targetId, details) {
        const result = await db.query(
            `INSERT INTO activity_logs (user_id, action, target_type, target_id, details)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [userId, action, targetType, targetId, details || {}]
        );
        return result.rows[0];
    }

    async getUserActivityLogs(userId, limit = 50, offset = 0) {
        const result = await db.query(
            `SELECT * FROM activity_logs 
             WHERE user_id = $1 
             ORDER BY created_at DESC 
             LIMIT $2 OFFSET $3`,
            [userId, limit, offset]
        );
        return result.rows;
    }
}

module.exports = new ActivityRepository();
