const db = require('../config/db');

class OtpRepository {
    async create(userId, email, otpCode, expiresAt) {
        // Invalidate any previous unused OTPs for this email
        await db.query(
            `UPDATE login_otps SET is_used = true WHERE email = $1 AND is_used = false`,
            [email]
        );

        const result = await db.query(
            `INSERT INTO login_otps (user_id, email, otp_code, expires_at)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [userId, email, otpCode, expiresAt]
        );
        return result.rows[0];
    }

    async findValidOtp(email, otpCode) {
        const result = await db.query(
            `SELECT * FROM login_otps 
             WHERE email = $1 AND otp_code = $2 AND is_used = false AND expires_at > NOW()
             ORDER BY created_at DESC LIMIT 1`,
            [email, otpCode]
        );
        return result.rows[0];
    }

    async markAsUsed(id) {
        const result = await db.query(
            `UPDATE login_otps SET is_used = true WHERE id = $1 RETURNING *`,
            [id]
        );
        return result.rows[0];
    }
}

module.exports = new OtpRepository();
