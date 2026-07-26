const db = require('../config/db');

class UserRepository {
    async create(email, passwordHash, fullName, roleId, accessKey = null) {
        const result = await db.query(
            `INSERT INTO users (email, password_hash, full_name, role_id, access_key) 
             VALUES ($1, $2, $3, $4, $5) RETURNING id, email, full_name, role_id, access_key, created_at`,
            [email, passwordHash, fullName, roleId, accessKey]
        );
        return result.rows[0];
    }

    async findByEmail(email) {
        const result = await db.query(
            `SELECT u.*, r.name as role_name 
             FROM users u 
             LEFT JOIN roles r ON u.role_id = r.id 
             WHERE u.email = $1`,
            [email]
        );
        return result.rows[0];
    }
    
    // password_changed_at is what lets authMiddleware evict access tokens minted
    // before the reset, so it is stamped in the same statement as the hash.
    async updatePassword(userId, passwordHash) {
        const result = await db.query(
            `UPDATE users
             SET password_hash = $2, password_changed_at = CURRENT_TIMESTAMP
             WHERE id = $1
             RETURNING id, email, full_name`,
            [userId, passwordHash]
        );
        return result.rows[0];
    }

    async findById(id) {
        const result = await db.query(
            `SELECT u.*, r.name as role_name 
             FROM users u 
             LEFT JOIN roles r ON u.role_id = r.id 
             WHERE u.id = $1`,
            [id]
        );
        return result.rows[0];
    }
}

module.exports = new UserRepository();
