const db = require('../config/db');

class NotificationRepository {
    async create(userId, senderId, title, message, type = 'share', link = '/shared') {
        const result = await db.query(
            `INSERT INTO notifications (user_id, sender_id, title, message, type, link) 
             VALUES ($1, $2, $3, $4, $5, $6) 
             RETURNING *`,
            [userId, senderId, title, message, type, link]
        );
        return result.rows[0];
    }

    async findByUserId(userId, limit = 20) {
        const result = await db.query(
            `SELECT n.*, u.full_name as sender_name, u.email as sender_email 
             FROM notifications n 
             LEFT JOIN users u ON n.sender_id = u.id 
             WHERE n.user_id = $1 
             ORDER BY n.created_at DESC 
             LIMIT $2`,
            [userId, limit]
        );
        return result.rows;
    }

    async countUnread(userId) {
        const result = await db.query(
            `SELECT COUNT(*) as unread_count 
             FROM notifications 
             WHERE user_id = $1 AND is_read = false`,
            [userId]
        );
        return parseInt(result.rows[0].unread_count, 10);
    }

    async markAsRead(id, userId) {
        const result = await db.query(
            `UPDATE notifications 
             SET is_read = true 
             WHERE id = $1 AND user_id = $2 
             RETURNING *`,
            [id, userId]
        );
        return result.rows[0];
    }

    async markAllAsRead(userId) {
        await db.query(
            `UPDATE notifications 
             SET is_read = true 
             WHERE user_id = $1 AND is_read = false`,
            [userId]
        );
    }
}

module.exports = new NotificationRepository();
