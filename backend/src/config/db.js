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

pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    getClient: () => pool.connect()
};
