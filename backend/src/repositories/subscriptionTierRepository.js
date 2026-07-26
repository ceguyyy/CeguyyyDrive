const db = require('../config/db');
const logger = require('../utils/logger');

// Postgres: undefined_table. Raised on every read here until migration 018 runs.
const UNDEFINED_TABLE = '42P01';

// Provisioning must not fail just because the tier table is not there yet:
// callers already carry hardcoded defaults for exactly this case. Writes are
// deliberately not wrapped — a create/update against a missing table is a real
// error the admin needs to see.
async function readOrDegrade(run, fallback, context) {
    try {
        return await run();
    } catch (err) {
        if (err.code !== UNDEFINED_TABLE) throw err;
        logger.warn(
            `subscription_tiers is missing (${context}); falling back to built-in plan defaults. Run "npm run migrate".`
        );
        return fallback;
    }
}

// Tiers are presets: organizations and org_licenses copy the numbers at
// creation time and own them from then on. Nothing here cascades — applying an
// edited tier to existing rows is a separate, explicit call.
class SubscriptionTierRepository {
    // Usage counts drive the "apply to N existing organizations?" prompt and
    // the delete confirmation, so they ship with the list rather than needing a
    // second round trip.
    async findAll() {
        return await readOrDegrade(async () => {
            const result = await db.query(
                `SELECT t.*,
                        (SELECT COUNT(*)::int FROM organizations o WHERE o.plan_name = t.name) AS organization_count,
                        (SELECT COUNT(*)::int FROM org_licenses l
                          WHERE l.plan_name = t.name AND l.status = 'available') AS available_license_count
                 FROM subscription_tiers t
                 ORDER BY t.sort_order ASC, t.name ASC`
            );
            return result.rows;
        }, [], 'findAll');
    }

    async findById(id) {
        return await readOrDegrade(async () => {
            const result = await db.query(`SELECT * FROM subscription_tiers WHERE id = $1`, [id]);
            return result.rows[0];
        }, undefined, 'findById');
    }

    async findByName(name) {
        return await readOrDegrade(async () => {
            const result = await db.query(
                `SELECT * FROM subscription_tiers WHERE LOWER(name) = LOWER($1)`,
                [String(name || '').trim()]
            );
            return result.rows[0];
        }, undefined, 'findByName');
    }

    async create({
        name, label, storageLimitBytes, memberStorageLimitBytes, maxMembers,
        maxOrganizations, featureApprovalEnabled, featureChatEnabled,
        featureIntegrationEnabled, sortOrder
    }) {
        const result = await db.query(
            `INSERT INTO subscription_tiers (
                name, label, storage_limit_bytes, member_storage_limit_bytes,
                max_members, max_organizations, feature_approval_enabled,
                feature_chat_enabled, feature_integration_enabled, sort_order
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING *`,
            [name, label, storageLimitBytes, memberStorageLimitBytes, maxMembers,
                maxOrganizations, featureApprovalEnabled, featureChatEnabled,
                featureIntegrationEnabled, sortOrder]
        );
        return result.rows[0];
    }

    async update(id, {
        name, label, storageLimitBytes, memberStorageLimitBytes, maxMembers,
        maxOrganizations, featureApprovalEnabled, featureChatEnabled,
        featureIntegrationEnabled, sortOrder
    }) {
        const result = await db.query(
            `UPDATE subscription_tiers
             SET name = COALESCE($2, name),
                 label = COALESCE($3, label),
                 storage_limit_bytes = COALESCE($4, storage_limit_bytes),
                 member_storage_limit_bytes = COALESCE($5, member_storage_limit_bytes),
                 max_members = COALESCE($6, max_members),
                 max_organizations = COALESCE($7, max_organizations),
                 feature_approval_enabled = COALESCE($8, feature_approval_enabled),
                 feature_chat_enabled = COALESCE($9, feature_chat_enabled),
                 feature_integration_enabled = COALESCE($10, feature_integration_enabled),
                 sort_order = COALESCE($11, sort_order)
             WHERE id = $1
             RETURNING *`,
            [id, name, label, storageLimitBytes, memberStorageLimitBytes, maxMembers,
                maxOrganizations, featureApprovalEnabled, featureChatEnabled,
                featureIntegrationEnabled, sortOrder]
        );
        return result.rows[0];
    }

    async delete(id) {
        const result = await db.query(
            `DELETE FROM subscription_tiers WHERE id = $1 RETURNING *`,
            [id]
        );
        return result.rows[0];
    }

    // Opt-in propagation. Overwrites per-organization overrides an admin may
    // have set by hand, which is why it never runs implicitly.
    async applyToExisting(planName, tier) {
        const client = await db.getClient();
        try {
            await client.query('BEGIN');

            const orgRes = await client.query(
                `UPDATE organizations
                 SET storage_limit_bytes = $2,
                     member_storage_limit_bytes = $3,
                     max_members = $4,
                     max_organizations = $5,
                     feature_approval_enabled = $6,
                     feature_chat_enabled = $7,
                     feature_integration_enabled = $8
                 WHERE plan_name = $1
                 RETURNING id`,
                [planName, tier.storage_limit_bytes, tier.member_storage_limit_bytes,
                    tier.max_members, tier.max_organizations,
                    tier.feature_approval_enabled, tier.feature_chat_enabled,
                    tier.feature_integration_enabled]
            );

            // Redeemed licences already provisioned their organization, which the
            // statement above has just updated. Only unredeemed keys still carry
            // entitlements that have yet to be applied.
            const licRes = await client.query(
                `UPDATE org_licenses
                 SET storage_limit_bytes = $2,
                     member_storage_limit_bytes = $3,
                     max_members = $4,
                     max_organizations = $5,
                     feature_approval_enabled = $6,
                     feature_chat_enabled = $7,
                     feature_integration_enabled = $8
                 WHERE plan_name = $1 AND status = 'available'
                 RETURNING id`,
                [planName, tier.storage_limit_bytes, tier.member_storage_limit_bytes,
                    tier.max_members, tier.max_organizations,
                    tier.feature_approval_enabled, tier.feature_chat_enabled,
                    tier.feature_integration_enabled]
            );

            await client.query('COMMIT');
            return { organizations: orgRes.rowCount, licenses: licRes.rowCount };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    // Renaming a tier would otherwise orphan every row pointing at the old
    // name, since plan_name is matched by value.
    async renamePlanReferences(oldName, newName) {
        const client = await db.getClient();
        try {
            await client.query('BEGIN');
            await client.query(`UPDATE organizations SET plan_name = $2 WHERE plan_name = $1`, [oldName, newName]);
            await client.query(`UPDATE org_licenses SET plan_name = $2 WHERE plan_name = $1`, [oldName, newName]);
            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }
}

module.exports = new SubscriptionTierRepository();
