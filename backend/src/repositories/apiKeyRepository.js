const db = require('../config/db');

class ApiKeyRepository {
    // key_hash is never selected: nothing outside the auth lookup needs it, and
    // not returning it keeps it out of logs and API responses by construction.
    // Personal keys: organization_id IS NULL, scoped to one user's own drive.
    async findPersonal(userId) {
        const result = await db.query(
            `SELECT id, organization_id, created_by, name, key_prefix, scopes,
                    last_used_at, expires_at, revoked_at, created_at
             FROM api_keys
             WHERE organization_id IS NULL AND created_by = $1
             ORDER BY created_at DESC`,
            [userId]
        );
        return result.rows;
    }

    async revokePersonal(userId, keyId) {
        const result = await db.query(
            `UPDATE api_keys
             SET revoked_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND created_by = $2 AND organization_id IS NULL AND revoked_at IS NULL
             RETURNING id, name, revoked_at`,
            [keyId, userId]
        );
        return result.rows[0];
    }

    async findByOrganization(orgId) {
        const result = await db.query(
            `SELECT id, organization_id, created_by, name, key_prefix, scopes,
                    last_used_at, expires_at, revoked_at, created_at
             FROM api_keys
             WHERE organization_id = $1
             ORDER BY created_at DESC`,
            [orgId]
        );
        return result.rows;
    }

    async create({ organizationId, createdBy, name, keyPrefix, keyHash, scopes, expiresAt }) {
        const result = await db.query(
            `INSERT INTO api_keys (organization_id, created_by, name, key_prefix, key_hash, scopes, expires_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id, organization_id, created_by, name, key_prefix, scopes,
                       last_used_at, expires_at, revoked_at, created_at`,
            [organizationId, createdBy, name, keyPrefix, keyHash, scopes, expiresAt]
        );
        return result.rows[0];
    }

    // Joins the creator so the middleware can reject a key whose owner has been
    // suspended, without a second round trip.
    async findActiveByHash(keyHash) {
        const result = await db.query(
            `SELECT k.*, u.status AS creator_status
             FROM api_keys k
             LEFT JOIN users u ON k.created_by = u.id
             WHERE k.key_hash = $1
               AND k.revoked_at IS NULL
               AND (k.expires_at IS NULL OR k.expires_at > NOW())`,
            [keyHash]
        );
        return result.rows[0];
    }

    async revoke(orgId, keyId) {
        const result = await db.query(
            `UPDATE api_keys
             SET revoked_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND organization_id = $2 AND revoked_at IS NULL
             RETURNING id, name, revoked_at`,
            [keyId, orgId]
        );
        return result.rows[0];
    }

    // Throttled to once a minute: an integration polling every few seconds would
    // otherwise turn every read into a write on this row.
    async touchLastUsed(keyId) {
        await db.query(
            `UPDATE api_keys
             SET last_used_at = CURRENT_TIMESTAMP
             WHERE id = $1
               AND (last_used_at IS NULL OR last_used_at < NOW() - INTERVAL '1 minute')`,
            [keyId]
        );
    }
}

module.exports = new ApiKeyRepository();
