const COS = require('cos-nodejs-sdk-v5');
require('dotenv').config();

const cos = new COS({
    SecretId: process.env.TENCENT_SECRET_ID,
    SecretKey: process.env.TENCENT_SECRET_KEY,
});

cos.putBucketCors({
    Bucket: process.env.COS_BUCKET,
    Region: process.env.COS_REGION,
    CORSRules: [{
        "AllowedOrigin": ["http://localhost:5173", "http://127.0.0.1:5173"],
        "AllowedMethod": ["GET", "PUT", "POST", "DELETE", "HEAD"],
        "AllowedHeader": ["*"],
        "ExposeHeader": ["ETag", "Content-Length", "x-cos-request-id"],
        "MaxAgeSeconds": 600
    }]
}, function(err, data) {
    if (err) {
        console.error("Failed to set CORS:", err);
    } else {
        console.log("Successfully configured CORS for the bucket:", data);
    }
});
