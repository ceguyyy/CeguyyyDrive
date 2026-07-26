const { Client } = require('pg');
require('dotenv').config();

async function truncateAll() {
    console.log('Connecting to Neon PostgreSQL to truncate data...');
    
    if (!process.env.DATABASE_URL) {
        console.error('ERROR: DATABASE_URL environment variable is missing.');
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

        // Get all tables in public schema except migrations, roles, and static tables.
        //
        // subscription_tiers is preserved for the same reason as roles: it is
        // configuration, not user data. It is also unrecoverable if wiped —
        // schema_migrations survives, so migration 018 stays marked as applied
        // and `npm run migrate` would not re-seed the tiers.
        const res = await client.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_type = 'BASE TABLE'
              AND table_name NOT IN ('schema_migrations', 'roles', 'billing_plans', 'subscription_tiers');
        `);

        const tables = res.rows.map(row => row.table_name);
        
        if (tables.length === 0) {
            console.log('No tables found to truncate.');
        } else {
            const tableList = tables.map(t => `"${t}"`).join(', ');
            console.log(`Truncating tables: ${tableList}`);
            await client.query(`TRUNCATE TABLE ${tableList} CASCADE;`);
            console.log('✅ All data truncated successfully! (Roles and Migrations preserved)');
        }

        // Re-ensure default roles exist just in case
        await client.query("INSERT INTO roles (name) VALUES ('owner'), ('user') ON CONFLICT DO NOTHING;");
        console.log('✅ Verified default roles (owner, user) exist.');

    } catch (error) {
        console.error('Truncation failed:', error);
        process.exit(1);
    } finally {
        await client.end();
    }
}

truncateAll();
