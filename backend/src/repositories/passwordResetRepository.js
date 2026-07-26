const db = require('../config/db');

class PasswordResetRepository {
    async create(userId, email, otpCode, expiresAt) {
        // Requesting a new code retires every earlier one, so a code sitting in
        // an older email cannot still be redeemed.
        await db.query(
            `UPDATE password_reset_otps SET is_used = true WHERE email = $1 AND is_used = false`,
            [email]
        );

        const result = await db.query(
            `INSERT INTO password_reset_otps (user_id, email, otp_code, expires_at)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [userId, email, otpCode, expiresAt]
        );
        return result.rows[0];
    }

    // Looked up by email alone, not by (email, code): the caller must be able to
    // count a wrong guess against `attempts`, which is impossible if a wrong
    // code simply returns no row.
    async findActive(email) {
        const result = await db.query(
            `SELECT * FROM password_reset_otps
             WHERE email = $1 AND is_used = false AND expires_at > NOW()
             ORDER BY created_at DESC LIMIT 1`,
            [email]
        );
        return result.rows[0];
    }

    async incrementAttempts(id) {
        const result = await db.query(
            `UPDATE password_reset_otps SET attempts = attempts + 1 WHERE id = $1 RETURNING attempts`,
            [id]
        );
        return result.rows[0]?.attempts ?? 0;
    }

    async markAsUsed(id) {
        const result = await db.query(
            `UPDATE password_reset_otps SET is_used = true WHERE id = $1 RETURNING *`,
            [id]
        );
        return result.rows[0];
    }
}

module.exports = new PasswordResetRepository();
