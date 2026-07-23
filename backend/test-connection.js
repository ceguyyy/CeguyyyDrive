require('dotenv').config({ override: true });
const db = require('./src/config/db');
const COS = require('cos-nodejs-sdk-v5');

async function testConnections() {
    console.log('--- STARTING CONNECTION TESTS ---');

    // 1. Test PostgreSQL Connection
    try {
        console.log('\n[1/2] Testing PostgreSQL (Neon) Database Connection...');
        const result = await db.query('SELECT NOW() AS current_time');
        console.log('✅ PostgreSQL Connection SUCCESS!');
        console.log('   Server Time:', result.rows[0].current_time);
    } catch (err) {
        console.error('❌ PostgreSQL Connection FAILED!');
        console.error(err);
    }

    // 2. Test Tencent COS Connection
    try {
        console.log('\n[2/2] Testing Tencent COS Connection...');
        
        const cos = new COS({
            SecretId: process.env.TENCENT_SECRET_ID,
            SecretKey: process.env.TENCENT_SECRET_KEY,
        });

        const bucket = process.env.COS_BUCKET;
        const region = process.env.COS_REGION;

        if (!bucket || !region) {
            throw new Error('COS_BUCKET or COS_REGION is not defined in .env');
        }

        // We use headBucket to check if the bucket exists and we have permissions to access it.
        // This makes an actual network request to Tencent servers.
        await new Promise((resolve, reject) => {
            cos.headBucket({
                Bucket: bucket,
                Region: region
            }, (err, data) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(data);
                }
            });
        });

        console.log('✅ Tencent COS Connection SUCCESS!');
        console.log(`   Successfully authenticated and accessed bucket: ${bucket} in region: ${region}`);

    } catch (err) {
        console.error('❌ Tencent COS Connection FAILED!');
        console.error(err);
    }

    console.log('\n--- CONNECTION TESTS COMPLETE ---');
    process.exit(0);
}

testConnections();
