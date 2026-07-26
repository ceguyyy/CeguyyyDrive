const db = require('../config/db');
const AppError = require('../utils/AppError');

const ALLOWED_STATUSES = ['active', 'suspended'];

/**
 * Platform-wide user administration for the Super Admin console.
 *
 * Suspension is enforced on every request in authMiddleware.protect, not only
 * at sign-in, so it takes effect immediately rather than whenever the user's
 * existing token happens to expire.
 */
class ManagedUserService {
    async getAllUsers() {
        const result = await db.query(
            `SELECT u.id, u.email, u.full_name, u.status, u.suspension_reason,
                    u.suspended_at, u.created_at,
                    r.name AS role_name,
                    (SELECT COUNT(*)::int FROM organizations o WHERE o.owner_id = u.id) AS owned_org_count,
                    (SELECT COUNT(*)::int FROM organization_members m
                      WHERE m.user_id = u.id AND m.status = 'accepted') AS membership_count,
                    COALESCE((
                        SELECT SUM(f.size)::bigint FROM files f
                        WHERE f.user_id = u.id AND f.is_deleted = false
                    ), 0) AS storage_used_bytes
             FROM users u
             LEFT JOIN roles r ON u.role_id = r.id
             ORDER BY u.created_at DESC`
        );
        return result.rows;
    }

    async updateStatus(userId, status, reason, requesterId) {
        if (!ALLOWED_STATUSES.includes(status)) {
            throw new AppError(`Status must be one of: ${ALLOWED_STATUSES.join(', ')}`, 400);
        }

        // Suspending yourself would lock the console behind an account that can
        // no longer sign in to undo it.
        if (String(userId) === String(requesterId) && status === 'suspended') {
            throw new AppError('You cannot suspend your own account.', 400);
        }

        const target = await db.query(`SELECT id FROM users WHERE id = $1`, [userId]);
        if (!target.rows[0]) throw new AppError('User not found', 404);

        const result = await db.query(
            `UPDATE users
             SET status = $2,
                 suspension_reason = CASE WHEN $2 = 'suspended' THEN $3 ELSE NULL END,
                 suspended_at = CASE WHEN $2 = 'suspended' THEN CURRENT_TIMESTAMP ELSE NULL END
             WHERE id = $1
             RETURNING id, email, full_name, status, suspension_reason, suspended_at`,
            [userId, status, reason || null]
        );
        return result.rows[0];
    }
}

module.exports = new ManagedUserService();
