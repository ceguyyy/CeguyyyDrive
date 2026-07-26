const db = require('../config/db');

class ApprovalTemplateRepository {
    async createTemplate(orgId, name, createdBy, steps, revisionPolicy = 'restart') {
        const client = await db.getClient();
        try {
            await client.query('BEGIN');
            const policy = revisionPolicy === 'resume' ? 'resume' : 'restart';
            const templateRes = await client.query(
                `INSERT INTO approval_templates (organization_id, name, created_by, revision_policy)
                 VALUES ($1, $2, $3, $4) RETURNING *`,
                [orgId, name, createdBy, policy]
            );
            const template = templateRes.rows[0];

            const savedSteps = [];
            for (let i = 0; i < steps.length; i++) {
                const s = steps[i];
                const stepRes = await client.query(
                    `INSERT INTO approval_template_steps (template_id, step_number, role_name, approver_id)
                     VALUES ($1, $2, $3, $4) RETURNING *`,
                    [template.id, i + 1, s.roleName || s.role_name, s.approverId || s.approver_id || null]
                );
                savedSteps.push(stepRes.rows[0]);
            }

            await client.query('COMMIT');
            return { ...template, steps: savedSteps };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    async getTemplatesByOrg(orgId) {
        const templatesRes = await db.query(
            `SELECT t.*, u.full_name as creator_name 
             FROM approval_templates t
             LEFT JOIN users u ON t.created_by = u.id
             WHERE t.organization_id = $1
             ORDER BY t.created_at DESC`,
            [orgId]
        );
        const templates = templatesRes.rows;

        for (const t of templates) {
            const stepsRes = await db.query(
                `SELECT s.*, u.full_name as approver_name
                 FROM approval_template_steps s
                 LEFT JOIN users u ON s.approver_id = u.id
                 WHERE s.template_id = $1
                 ORDER BY s.step_number ASC`,
                [t.id]
            );
            t.steps = stepsRes.rows;
        }

        return templates;
    }

    async updateTemplate(orgId, templateId, name, steps, revisionPolicy = null) {
        const client = await db.getClient();
        try {
            await client.query('BEGIN');
            const policy = revisionPolicy === 'resume' ? 'resume'
                : revisionPolicy === 'restart' ? 'restart'
                : null;
            const templateRes = await client.query(
                `UPDATE approval_templates
                 SET name = $1, revision_policy = COALESCE($4, revision_policy)
                 WHERE id = $2 AND organization_id = $3 RETURNING *`,
                [name, templateId, orgId, policy]
            );
            if (templateRes.rows.length === 0) {
                await client.query('ROLLBACK');
                return null;
            }
            const template = templateRes.rows[0];

            await client.query(`DELETE FROM approval_template_steps WHERE template_id = $1`, [templateId]);

            const savedSteps = [];
            for (let i = 0; i < steps.length; i++) {
                const s = steps[i];
                const stepRes = await client.query(
                    `INSERT INTO approval_template_steps (template_id, step_number, role_name, approver_id)
                     VALUES ($1, $2, $3, $4) RETURNING *`,
                    [templateId, i + 1, s.roleName || s.role_name, s.approverId || s.approver_id || null]
                );
                savedSteps.push(stepRes.rows[0]);
            }

            await client.query('COMMIT');
            return { ...template, steps: savedSteps };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    async deleteTemplate(orgId, templateId) {
        const res = await db.query(
            `DELETE FROM approval_templates WHERE id = $1 AND organization_id = $2 RETURNING *`,
            [templateId, orgId]
        );
        return res.rows[0];
    }
}

module.exports = new ApprovalTemplateRepository();
