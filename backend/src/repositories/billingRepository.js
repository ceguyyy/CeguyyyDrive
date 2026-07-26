const db = require('../config/db');

class BillingRepository {
    async createLicenseKey({ licenseKey, ownerEmail, planName = 'Pro', storageLimitBytes = 10737418240, maxMembers = 25, memberStorageLimitBytes = 10737418240, featureApprovalEnabled = true, featureChatEnabled = true, maxOrganizations = 1, createdBy = null, gmtLocation = 'GMT+7 (Asia/Jakarta)', customAppTitle = null, customLogoUrl = null }) {
        const result = await db.query(
            `INSERT INTO org_licenses (
                license_key, owner_email, plan_name, storage_limit_bytes, max_members, member_storage_limit_bytes,
                feature_approval_enabled, feature_chat_enabled, max_organizations, status, created_by, gmt_location, custom_app_title, custom_logo_url
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'available', $10, $11, $12, $13)
            RETURNING *`,
            [licenseKey.trim(), ownerEmail.trim().toLowerCase(), planName, storageLimitBytes, maxMembers, memberStorageLimitBytes, featureApprovalEnabled, featureChatEnabled, maxOrganizations, createdBy, gmtLocation, customAppTitle, customLogoUrl]
        );
        return result.rows[0];
    }

    async findAllLicenseKeys() {
        const result = await db.query(
            `SELECT l.*, o.name as redeemed_org_name
             FROM org_licenses l
             LEFT JOIN organizations o ON l.redeemed_by_org_id = o.id
             ORDER BY l.created_at DESC`
        );
        return result.rows;
    }

    // Uniqueness check: matches regardless of status, since a redeemed or
    // revoked key still occupies the UNIQUE license_key column.
    async findLicenseByKey(licenseKey) {
        const result = await db.query(
            `SELECT id FROM org_licenses WHERE license_key = $1`,
            [licenseKey.trim()]
        );
        return result.rows[0];
    }

    async findAvailableLicenseByKey(licenseKey) {
        const result = await db.query(
            `SELECT * FROM org_licenses 
             WHERE license_key = $1 AND status = 'available'`,
             [licenseKey.trim()]
        );
        return result.rows[0];
    }

    async markLicenseRedeemed(licenseId, orgId) {
        const result = await db.query(
            `UPDATE org_licenses 
             SET status = 'redeemed', redeemed_by_org_id = $2, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 RETURNING *`,
            [licenseId, orgId]
        );
        return result.rows[0];
    }

    async deleteLicenseKey(id) {
        const result = await db.query(
            `DELETE FROM org_licenses WHERE id = $1 RETURNING *`,
            [id]
        );
        return result.rows[0];
    }

    async findAllOrganizations() {
        const result = await db.query(
            `SELECT o.*, 
                    u.email as owner_email, u.full_name as owner_name,
                    (SELECT COUNT(*)::int FROM organization_members WHERE organization_id = o.id AND status = 'accepted') as member_count,
                    COALESCE((
                        SELECT SUM(f.size)::bigint FROM files f
                        JOIN folders fld ON f.folder_id = fld.id
                        WHERE fld.organization_id = o.id AND f.is_deleted = false
                    ), 0) as storage_used_bytes
             FROM organizations o
             LEFT JOIN users u ON o.owner_id = u.id
             ORDER BY o.created_at DESC`
        );
        return result.rows;
    }

    async updateOrganizationBilling(orgId, { planName, storageLimitBytes, maxMembers, memberStorageLimitBytes, featureApprovalEnabled, featureChatEnabled, maxOrganizations, status, billingNotes, gmtLocation, customAppTitle, customLogoUrl }) {
        const result = await db.query(
            `UPDATE organizations
             SET plan_name = COALESCE($2, plan_name),
                 storage_limit_bytes = COALESCE($3, storage_limit_bytes),
                 max_members = COALESCE($4, max_members),
                 member_storage_limit_bytes = COALESCE($5, member_storage_limit_bytes),
                 feature_approval_enabled = COALESCE($6, feature_approval_enabled),
                 feature_chat_enabled = COALESCE($7, feature_chat_enabled),
                 max_organizations = COALESCE($8, max_organizations),
                 status = COALESCE($9, status),
                 billing_notes = COALESCE($10, billing_notes),
                 gmt_location = COALESCE($11, gmt_location),
                 custom_app_title = COALESCE($12, custom_app_title),
                 custom_logo_url = COALESCE($13, custom_logo_url)
             WHERE id = $1 RETURNING *`,
            [orgId, planName, storageLimitBytes, maxMembers, memberStorageLimitBytes, featureApprovalEnabled, featureChatEnabled, maxOrganizations, status, billingNotes, gmtLocation, customAppTitle !== undefined ? customAppTitle : null, customLogoUrl !== undefined ? customLogoUrl : null]
        );
        return result.rows[0];
    }

    async updateOrganizationStatus(orgId, status) {
        const result = await db.query(
            `UPDATE organizations SET status = $2 WHERE id = $1 RETURNING *`,
            [orgId, status]
        );
        return result.rows[0];
    }

    async deleteOrganizationAdmin(orgId) {
        const result = await db.query(
            `DELETE FROM organizations WHERE id = $1 RETURNING *`,
            [orgId]
        );
        return result.rows[0];
    }

    async getPlatformStats() {
        const orgsRes = await db.query(`SELECT COUNT(*)::int as total_orgs FROM organizations`);
        // Grouped rather than a hardcoded IN ('Pro','Enterprise','Custom'): tiers
        // are editable now, so any fixed list goes stale the moment an admin adds
        // one. The caller picks which plan to display.
        const byPlanRes = await db.query(`
            SELECT COALESCE(NULLIF(TRIM(plan_name), ''), 'Unassigned') AS plan_name,
                   COUNT(*)::int AS count
            FROM organizations
            WHERE status = 'active'
            GROUP BY 1
            ORDER BY count DESC, plan_name ASC
        `);
        const storageRes = await db.query(`SELECT COALESCE(SUM(storage_limit_bytes), 0)::bigint as total_capacity FROM organizations`);
        const usedRes = await db.query(`
            SELECT COALESCE(SUM(f.size), 0)::bigint as total_used 
            FROM files f 
            JOIN folders fld ON f.folder_id = fld.id 
            WHERE fld.organization_id IS NOT NULL AND f.is_deleted = false
        `);
        const licensesRes = await db.query(`SELECT COUNT(*)::int as available_licenses FROM org_licenses WHERE status = 'available'`);

        return {
            total_orgs: orgsRes.rows[0].total_orgs,
            orgs_by_plan: byPlanRes.rows,
            total_capacity_bytes: storageRes.rows[0].total_capacity,
            total_used_bytes: usedRes.rows[0].total_used,
            available_licenses: licensesRes.rows[0].available_licenses
        };
    }
}

module.exports = new BillingRepository();
