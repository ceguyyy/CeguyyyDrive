const COS = require('cos-nodejs-sdk-v5');
const crypto = require('crypto');
const AppError = require('../utils/AppError');

class CosService {
    constructor() {
        this.cos = new COS({
            SecretId: process.env.TENCENT_SECRET_ID,
            SecretKey: process.env.TENCENT_SECRET_KEY,
        });
        this.bucket = process.env.COS_BUCKET;
        this.region = process.env.COS_REGION;
    }

    generateObjectKey(userId, fileName) {
        // Generate a unique object key to prevent overwrites in the flat COS bucket
        // Format: {userId}/{uuid}_{fileName}
        const uuid = crypto.randomUUID();
        return `${userId}/${uuid}_${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    }

    getPresignedUploadUrl(objectKey) {
        return new Promise((resolve, reject) => {
            this.cos.getObjectUrl({
                Bucket: this.bucket,
                Region: this.region,
                Key: objectKey,
                Method: 'PUT',
                Sign: true,
                Expires: 900 // 15 minutes
            }, (err, data) => {
                if (err) {
                    console.error('COS Upload Sign Error:', err);
                    return reject(new AppError('Failed to generate upload URL', 500));
                }
                resolve(data.Url);
            });
        });
    }

    getPresignedDownloadUrl(objectKey) {
        return new Promise((resolve, reject) => {
            this.cos.getObjectUrl({
                Bucket: this.bucket,
                Region: this.region,
                Key: objectKey,
                Method: 'GET',
                Sign: true,
                Expires: 3600 // 1 hour
            }, (err, data) => {
                if (err) {
                    console.error('COS Download Sign Error:', err);
                    return reject(new AppError('Failed to generate download URL', 500));
                }
                resolve(data.Url);
            });
        });
    }

    deleteObject(objectKey) {
        return new Promise((resolve, reject) => {
            this.cos.deleteObject({
                Bucket: this.bucket,
                Region: this.region,
                Key: objectKey
            }, (err, data) => {
                if (err) {
                    console.error('COS Delete Object Error:', err);
                    // We don't reject here because we want to proceed with DB deletion 
                    // even if cloud deletion fails (to prevent ghost locks).
                    // In a production system, failed cloud deletes should be queued for retry.
                    return resolve(false); 
                }
                resolve(true);
            });
        });
    }

    copyObject(sourceKey, targetKey) {
        return new Promise((resolve, reject) => {
            this.cos.putObjectCopy({
                Bucket: this.bucket,
                Region: this.region,
                Key: targetKey,
                CopySource: `${this.bucket}.cos.${this.region}.myqcloud.com/${sourceKey}`
            }, (err, data) => {
                if (err) {
                    console.error('COS Copy Object Error:', err);
                    return reject(new AppError('Failed to copy file in storage', 500));
                }
                resolve(data);
            });
        });
    }
}

module.exports = new CosService();
