const db = require('../config/db');

class UserRepository {
    async create(email, passwordHash, fullName, roleId) {
        const result = await db.query(
            `INSERT INTO users (email, password_hash, full_name, role_id) 
             VALUES ($1, $2, $3, $4) RETURNING id, email, full_name, role_id, created_at`,
            [email, passwordHash, fullName, roleId]
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
    
    async findById(id) {
        const result = await db.query(
            `SELECT u.id, u.email, u.full_name, u.role_id, r.name as role_name 
             FROM users u 
             LEFT JOIN roles r ON u.role_id = r.id 
             WHERE u.id = $1`,
            [id]
        );
        return result.rows[0];
    }
}

module.exports = new UserRepository();
