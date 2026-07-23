const db = require('../config/db');

class RoleRepository {
    async findByName(name) {
        const result = await db.query('SELECT * FROM roles WHERE name = $1', [name]);
        return result.rows[0];
    }
}

module.exports = new RoleRepository();
