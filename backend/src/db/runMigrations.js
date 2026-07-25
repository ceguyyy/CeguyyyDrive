const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigrations() {
    console.log('Starting database migrations...');
    
    if (!process.env.DATABASE_URL) {
        console.error('ERROR: DATABASE_URL environment variable is missing.');
        console.error('Please create a .env file based on .env.example with a valid Neon PostgreSQL connection string.');
        process.exit(1);
    }

    let connectionString = process.env.DATABASE_URL;
    try {
        const parsed = new URL(connectionString);
        parsed.searchParams.delete('sslmode');
        connectionString = parsed.toString();
    } catch {
        // fallback to raw connection string
    }

    const isLocal = process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1');

    const client = new Client({
        connectionString,
        ssl: isLocal ? false : { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected to database.');

        // Initialize schema_migrations table if it doesn't exist
        await client.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version VARCHAR(255) PRIMARY KEY,
                applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        const migrationsDir = path.join(__dirname, 'migrations');
        const files = fs.readdirSync(migrationsDir).sort();

        for (const file of files) {
            if (!file.endsWith('.sql')) continue;

            const version = path.basename(file, '.sql');
            
            const checkRes = await client.query('SELECT version FROM schema_migrations WHERE version = $1', [version]);
            if (checkRes.rows.length > 0) {
                console.log(`Migration ${version} already applied. Skipping.`);
                continue;
            }

            console.log(`Applying migration: ${version}`);
            const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

            await client.query('BEGIN');
            try {
                await client.query(sql);
                await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
                await client.query('COMMIT');
                console.log(`Successfully applied ${version}`);
            } catch (err) {
                await client.query('ROLLBACK');
                console.error(`Error applying migration ${version}:`, err);
                throw err;
            }
        }
        
        console.log('All migrations applied successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        await client.end();
    }
}

runMigrations();
