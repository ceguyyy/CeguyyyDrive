const db = require('../config/db');

class OrganizationRepository {
    async createOrganization(name, ownerId) {
        const client = await db.getClient();
        try {
            await client.query('BEGIN');
            const orgRes = await client.query(
                `INSERT INTO organizations (name, owner_id) VALUES ($1, $2) RETURNING *`,
                [name, ownerId]
            );
            const org = orgRes.rows[0];

            // Add owner as accepted Owner member
            await client.query(
                `INSERT INTO organization_members (organization_id, user_id, email, role_name, status) 
                 SELECT $1, id, email, 'Owner', 'accepted' FROM users WHERE id = $2`,
                [org.id, ownerId]
            );

            // Add default roles (CEO, Manager, Staff)
            const ceoRes = await client.query(
                `INSERT INTO organization_roles (organization_id, name, parent_role_id, canvas_position_x, canvas_position_y, color) 
                 VALUES ($1, 'CEO', NULL, 250, 50, '#EF4444') RETURNING id`,
                [org.id]
            );
            const ceoId = ceoRes.rows[0].id;

            const mgrRes = await client.query(
                `INSERT INTO organization_roles (organization_id, name, parent_role_id, canvas_position_x, canvas_position_y, color) 
                 VALUES ($1, 'Manager', $2, 250, 180, '#3B82F6') RETURNING id`,
                [org.id, ceoId]
            );
            const mgrId = mgrRes.rows[0].id;

            await client.query(
                `INSERT INTO organization_roles (organization_id, name, parent_role_id, canvas_position_x, canvas_position_y, color) 
                 VALUES ($1, 'Staff', $2, 250, 310, '#10B981')`,
                [org.id, mgrId]
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
             WHERE om.user_id = $1 OR om.email = (SELECT email FROM users WHERE id = $1)
             ORDER BY o.created_at DESC`,
            [userId]
        );
        return result.rows;
    }

    async findOrganizationById(id) {
        const result = await db.query(`SELECT * FROM organizations WHERE id = $1`, [id]);
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
            `SELECT om.*, u.full_name, u.avatar_url
             FROM organization_members om
             LEFT JOIN users u ON om.user_id = u.id OR om.email = u.email
             WHERE om.organization_id = $1
             ORDER BY om.created_at DESC`,
            [orgId]
        );
        return result.rows;
    }

    async updateMemberStatus(orgId, userId, status) {
        const result = await db.query(
            `UPDATE organization_members 
             SET status = $3, user_id = $2
             WHERE organization_id = $1 AND (user_id = $2 OR email = (SELECT email FROM users WHERE id = $2))
             RETURNING *`,
            [orgId, userId, status]
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
                    `INSERT INTO organization_roles (id, organization_id, name, parent_role_id, canvas_position_x, canvas_position_y, color)
                     VALUES (COALESCE($1, uuid_generate_v4()), $2, $3, $4, $5, $6, $7)
                     RETURNING *`,
                    [r.id || null, orgId, r.name, r.parent_role_id || null, r.canvas_position_x || 250, r.canvas_position_y || 100, r.color || '#3B82F6']
                );
                inserted.push(res.rows[0]);
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
}

module.exports = new OrganizationRepository();
