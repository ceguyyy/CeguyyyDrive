const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
    try {
        const res = await pool.query(
            "SELECT id, name FROM organization_roles WHERE name NOT IN ('Owner','Manager','Staff') ORDER BY id"
        );
        console.log('Extra roles found:', res.rows);
        if (res.rows.length > 0) {
            await pool.query(
                "DELETE FROM organization_roles WHERE name NOT IN ('Owner','Manager','Staff')"
            );
            console.log('Deleted', res.rows.length, 'extra role(s)');
        } else {
            console.log('No extra roles to clean');
        }
    } catch(e) {
        console.error('Error:', e.message);
    }
    process.exit(0);
}
run();
