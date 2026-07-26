const { Pool } = require('pg');
require('dotenv').config();

function getCleanConnectionString(url) {
    if (!url) return url;
    try {
        const parsed = new URL(url);
        parsed.searchParams.delete('sslmode');
        return parsed.toString();
    } catch {
        return url;
    }
}

const isLocal = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1');
const pool = new Pool({
    connectionString: getCleanConnectionString(process.env.DATABASE_URL),
    ssl: isLocal ? false : { rejectUnauthorized: false }
});

async function run() {
    try {
        console.log('Ensuring Super Admin roles exist in database...');
        await pool.query("INSERT INTO roles (name) VALUES ('owner'), ('super_admin'), ('super admin'), ('admin'), ('user') ON CONFLICT DO NOTHING");
        
        const ownerRole = await pool.query("SELECT id FROM roles WHERE name = 'owner' LIMIT 1");
        if (ownerRole.rows.length > 0) {
            const roleId = ownerRole.rows[0].id;
            const updateRes = await pool.query("UPDATE users SET role_id = $1 RETURNING email", [roleId]);
            console.log(`Successfully updated ${updateRes.rowCount} user(s) to Super Admin ('owner' / 'super_admin') role:`, updateRes.rows.map(r => r.email));
        }
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

run();
