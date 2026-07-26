const db = require('../config/db');

class RoleRepository {
    async findByName(name) {
        let result = await db.query('SELECT * FROM roles WHERE name = $1', [name]);
        if (!result.rows[0] && ['owner', 'super_admin', 'super admin', 'admin', 'user'].includes(name)) {
            await db.query("INSERT INTO roles (name) VALUES ($1) ON CONFLICT DO NOTHING", [name]);
            result = await db.query('SELECT * FROM roles WHERE name = $1', [name]);
        }
        return result.rows[0];
    }
}

module.exports = new RoleRepository();
