const db = require('../config/db');
const subscriptionTierRepository = require('./subscriptionTierRepository');
const { maxOrganizationsForPlan, MAX_ORGANIZATIONS_WITHOUT_PLAN } = require('../config/planLimits');

class OrganizationRepository {
    async createOrganization(name, ownerId, billingConfig = {}) {
        const {
            licenseKey = null,
            planName = 'Free',
            storageLimitBytes = 5368709120, // 5 GB default
            maxMembers = 5,
            memberStorageLimitBytes = 5368709120, // 5 GB default per member
            featureApprovalEnabled = true,
            featureChatEnabled = true,
            // Off unless asked for: Integration exposes an API surface, so a new
            // organization does not gain one by omission.
            featureIntegrationEnabled = false,
            maxOrganizations = null,
            gmtLocation = 'GMT+7 (Asia/Jakarta)'
        } = billingConfig;

        // The editable tier wins; config/planLimits is the fallback for 'Custom',
        // a deleted tier, or a database that has not run migration 018.
        const tier = await subscriptionTierRepository.findByName(planName);
        const resolvedMaxOrganizations =
            maxOrganizations ?? tier?.max_organizations ?? maxOrganizationsForPlan(planName);

        const client = await db.getClient();
        try {
            await client.query('BEGIN');
            const orgRes = await client.query(
                `INSERT INTO organizations (
                    name, owner_id, license_key, plan_name, storage_limit_bytes, max_members, member_storage_limit_bytes,
                    feature_approval_enabled, feature_chat_enabled, feature_integration_enabled,
                    max_organizations, gmt_location, status
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'active') RETURNING *`,
                [name, ownerId, licenseKey, planName, storageLimitBytes, maxMembers, memberStorageLimitBytes, featureApprovalEnabled, featureChatEnabled, featureIntegrationEnabled, resolvedMaxOrganizations, gmtLocation]
            );
            const org = orgRes.rows[0];

            // Add owner as accepted Owner member
            await client.query(
                `INSERT INTO organization_members (organization_id, user_id, email, role_name, status) 
                 SELECT $1, id, email, 'Owner', 'accepted' FROM users WHERE id = $2`,
                [org.id, ownerId]
            );

            // Add default roles (Owner, Manager, Staff) with Owner receiving total storage quota
            const ceoRes = await client.query(
                `INSERT INTO organization_roles (organization_id, name, parent_role_id, canvas_position_x, canvas_position_y, color, storage_limit) 
                 VALUES ($1, 'Owner', NULL, 300, 50, '#EF4444', $2) RETURNING id`,
                [org.id, storageLimitBytes]
            );
            const ceoId = ceoRes.rows[0].id;

            const mgrRes = await client.query(
                `INSERT INTO organization_roles (organization_id, name, parent_role_id, canvas_position_x, canvas_position_y, color) 
                 VALUES ($1, 'Manager', $2, 250, 180, '#3B82F6') RETURNING id`,
                [org.id, ceoId]
            );
            const mgrId = mgrRes.rows[0].id;

            const staffRes = await client.query(
                `INSERT INTO organization_roles (organization_id, name, parent_role_id, canvas_position_x, canvas_position_y, color) 
                 VALUES ($1, 'Staff', $2, 250, 310, '#10B981') RETURNING id`,
                [org.id, mgrId]
            );
            const staffId = staffRes.rows[0].id;

            // Provision Company Drive root folders for default roles
            await client.query(
                `INSERT INTO folders (name, organization_id, owner_role_id, user_id)
                 VALUES ('Owner', $1, $2, NULL), ('Manager', $1, $3, NULL), ('Staff', $1, $4, NULL)`,
                [org.id, ceoId, mgrId, staffId]
            );

            await client.query('COMMIT');
            return org;
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    async findUserOrganizations(userId) {
        const result = await db.query(
            `SELECT o.*, om.role_name, om.status as membership_status,
                    (SELECT COUNT(*) FROM organization_members WHERE organization_id = o.id AND status = 'accepted') as member_count
             FROM organizations o
             JOIN organization_members om ON o.id = om.organization_id
             WHERE om.user_id = $1 OR LOWER(om.email) = (SELECT LOWER(email) FROM users WHERE id = $1)
             ORDER BY o.created_at DESC`,
            [userId]
        );
        return result.rows;
    }

    async findOrganizationById(id) {
        const result = await db.query(`SELECT * FROM organizations WHERE id = $1`, [id]);
        return result.rows[0];
    }

    async countOwnedOrganizations(ownerId) {
        const result = await db.query(
            `SELECT COUNT(*)::int AS count FROM organizations WHERE owner_id = $1`,
            [ownerId]
        );
        return result.rows[0].count;
    }

    // The owner's entitlement is the most generous plan among the organizations
    // they already own. Owning none means no plan, so no entitlement.
    async findMaxOrganizationsForOwner(ownerId) {
        const result = await db.query(
            `SELECT COALESCE(MAX(max_organizations), $2)::int AS max_organizations
             FROM organizations WHERE owner_id = $1`,
            [ownerId, MAX_ORGANIZATIONS_WITHOUT_PLAN]
        );
        return result.rows[0].max_organizations;
    }

    // The configuration a new organization should inherit. An owner on
    // Enterprise should not silently drop to Free when they create a second
    // workspace.
    //
    // A licensed organization wins over an unlicensed one regardless of size.
    // Licences carry the real entitlement; derived organizations merely copy it.
    // Ranking by storage alone would let a derived organization become the
    // source for the next one, so any inflation would compound with every
    // workspace created.
    //
    // Returns undefined for an owner with no organization yet — their first one
    // comes from a licence, which carries its own configuration.
    async findInheritablePlanForOwner(ownerId) {
        const result = await db.query(
            `SELECT plan_name, storage_limit_bytes, member_storage_limit_bytes,
                    max_members, max_organizations,
                    feature_approval_enabled, feature_chat_enabled, feature_integration_enabled,
                    gmt_location
             FROM organizations
             WHERE owner_id = $1
             ORDER BY (license_key IS NOT NULL) DESC,
                      storage_limit_bytes DESC NULLS LAST,
                      created_at ASC
             LIMIT 1`,
            [ownerId]
        );
        return result.rows[0];
    }

    async addMember(orgId, email, roleName = 'Member', targetUserId = null) {
        const result = await db.query(
            `INSERT INTO organization_members (organization_id, email, user_id, role_name, status)
             VALUES ($1, $2, $3, $4, 'pending')
             ON CONFLICT (organization_id, email) DO UPDATE SET role_name = $4, status = 'pending'
             RETURNING *`,
            [orgId, email, targetUserId, roleName]
        );
        return result.rows[0];
    }

    async findMembers(orgId) {
        const result = await db.query(
            `SELECT om.*, u.full_name, u.profile_picture as avatar_url
             FROM organization_members om
             LEFT JOIN users u ON om.user_id = u.id OR LOWER(om.email) = LOWER(u.email)
             WHERE om.organization_id = $1
             ORDER BY om.created_at DESC`,
            [orgId]
        );
        return result.rows;
    }

    // Matches on email as well as user_id: organization_members.user_id stays
    // null for invitees who had no account when they were invited, and the rest
    // of this repository resolves membership the same way.
    async findMemberByUserId(orgId, userId) {
        const result = await db.query(
            `SELECT * FROM organization_members
             WHERE organization_id = $1
               AND (user_id = $2 OR LOWER(email) = (SELECT LOWER(email) FROM users WHERE id = $2))`,
            [orgId, userId]
        );
        return result.rows[0];
    }

    // Invitations are addressed to an email before the invitee has an account,
    // so the registration path can only match on email.
    async findMemberByEmail(orgId, email) {
        const result = await db.query(
            `SELECT * FROM organization_members
             WHERE organization_id = $1 AND LOWER(email) = LOWER($2)`,
            [orgId, String(email || '').trim()]
        );
        return result.rows[0];
    }

    async findMemberById(orgId, memberId) {
        const result = await db.query(
            `SELECT * FROM organization_members WHERE id = $1 AND organization_id = $2`,
            [memberId, orgId]
        );
        return result.rows[0];
    }

    async updateMemberRole(orgId, memberId, roleName) {
        const result = await db.query(
            `UPDATE organization_members
             SET role_name = $3
             WHERE id = $1 AND organization_id = $2
             RETURNING *`,
            [memberId, orgId, roleName]
        );
        return result.rows[0];
    }

    async updateMemberStatus(orgId, userId, status) {
        const result = await db.query(
            `UPDATE organization_members 
             SET status = $3, user_id = $2
             WHERE organization_id = $1 AND (user_id = $2 OR LOWER(email) = (SELECT LOWER(email) FROM users WHERE id = $2))
             RETURNING *`,
            [orgId, userId, status]
        );
        return result.rows[0];
    }

    async removeMember(orgId, memberId) {
        const result = await db.query(
            `DELETE FROM organization_members WHERE id = $1 AND organization_id = $2 AND role_name != 'Owner' RETURNING *`,
            [memberId, orgId]
        );
        return result.rows[0];
    }

    async updateMemberStorageLimit(orgId, memberId, limitBytes) {
        const result = await db.query(
            `UPDATE organization_members 
             SET storage_limit = $3
             WHERE id = $1 AND organization_id = $2
             RETURNING *`,
            [memberId, orgId, limitBytes]
        );
        return result.rows[0];
    }

    async findRoles(orgId) {
        const result = await db.query(
            `SELECT * FROM organization_roles WHERE organization_id = $1 ORDER BY created_at ASC`,
            [orgId]
        );
        return result.rows;
    }

    async saveRoles(orgId, roles) {
        const client = await db.getClient();
        try {
            await client.query('BEGIN');
            await client.query(`DELETE FROM organization_roles WHERE organization_id = $1`, [orgId]);
            
            const inserted = [];
            for (const r of roles) {
                const res = await client.query(
                    `INSERT INTO organization_roles (id, organization_id, name, parent_role_id, canvas_position_x, canvas_position_y, color, storage_limit)
                     VALUES (COALESCE($1, uuid_generate_v4()), $2, $3, $4, $5, $6, $7, $8)
                     RETURNING *`,
                    [r.id || null, orgId, r.name, r.parent_role_id || null, r.canvas_position_x || 250, r.canvas_position_y || 100, r.color || '#3B82F6', r.storage_limit || null]
                );
                const role = res.rows[0];
                inserted.push(role);

                // Provision or update root folder for this role
                const existingFolder = await client.query(
                    `SELECT id FROM folders WHERE organization_id = $1 AND owner_role_id = $2`,
                    [orgId, role.id]
                );
                if (existingFolder.rows.length > 0) {
                    await client.query(
                        `UPDATE folders SET name = $1 WHERE id = $2`,
                        [role.name, existingFolder.rows[0].id]
                    );
                } else {
                    await client.query(
                        `INSERT INTO folders (name, organization_id, owner_role_id, user_id)
                         VALUES ($1, $2, $3, NULL)`,
                        [role.name, orgId, role.id]
                    );
                }
            }
            await client.query('COMMIT');
            return inserted;
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    async transferOwner(orgId, currentOwnerId, newOwnerId) {
        const client = await db.getClient();
        try {
            await client.query('BEGIN');
            // Update org owner_id
            await client.query(
                `UPDATE organizations SET owner_id = $1 WHERE id = $2 AND owner_id = $3`,
                [newOwnerId, orgId, currentOwnerId]
            );
            // Update old owner's membership role
            await client.query(
                `UPDATE organization_members SET role_name = 'Manager' WHERE organization_id = $1 AND user_id = $2`,
                [orgId, currentOwnerId]
            );
            // Update new owner's membership role
            await client.query(
                `UPDATE organization_members SET role_name = 'Owner' WHERE organization_id = $1 AND user_id = $2`,
                [orgId, newOwnerId]
            );
            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    async deleteOrganization(orgId, ownerId) {
        const result = await db.query(
            `DELETE FROM organizations WHERE id = $1 AND owner_id = $2 RETURNING *`,
            [orgId, ownerId]
        );
        return result.rows[0];
    }
}

module.exports = new OrganizationRepository();
