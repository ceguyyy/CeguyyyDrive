require('dotenv').config();
const db = require('./src/config/db');

async function migrate() {
    console.log('--- STARTING ACTIVITY LOGS MIGRATION ---');
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS activity_logs (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                action VARCHAR(50) NOT NULL,
                target_type VARCHAR(50) NOT NULL,
                target_id UUID,
                details JSONB DEFAULT '{}'::jsonb,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_activity_logs_user_created 
            ON activity_logs(user_id, created_at DESC);
        `);
        console.log('✅ activity_logs table created successfully!');
    } catch (err) {
        console.error('❌ Migration failed:', err);
    } finally {
        console.log('--- MIGRATION COMPLETE ---');
        process.exit(0);
    }
}

migrate();
