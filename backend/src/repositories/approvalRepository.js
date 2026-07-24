const db = require('../config/db');

class ApprovalRepository {
    async createApprovalRequest(orgId, fileId, folderId, requesterId, title, steps) {
        const client = await db.getClient();
        try {
            await client.query('BEGIN');
            
            const reqRes = await client.query(
                `INSERT INTO approval_requests (organization_id, file_id, folder_id, requester_id, title, status, current_step_index)
                 VALUES ($1, $2, $3, $4, $5, 'pending', 1)
                 RETURNING *`,
                [orgId, fileId || null, folderId || null, requesterId, title]
            );
            const request = reqRes.rows[0];

            const createdSteps = [];
            for (let i = 0; i < steps.length; i++) {
                const s = steps[i];
                const stepNum = i + 1;
                const stepStatus = stepNum === 1 ? 'pending' : 'queued';
                
                const stepRes = await client.query(
                    `INSERT INTO approval_steps (request_id, step_number, role_name, approver_id, status)
                     VALUES ($1, $2, $3, $4, $5)
                     RETURNING *`,
                    [request.id, stepNum, s.role_name, s.approver_id || null, stepStatus]
                );
                createdSteps.push(stepRes.rows[0]);
            }

            await client.query('COMMIT');
            return { request, steps: createdSteps };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    async findPendingApprovalsForUser(userId) {
        const result = await db.query(
            `SELECT ar.*, st.id as current_step_id, st.step_number, st.role_name,
                    u.full_name as requester_name, u.email as requester_email, u.avatar_url as requester_avatar,
                    f.original_name as file_name, f.size as file_size, f.mime_type,
                    fd.name as folder_name, o.name as organization_name
             FROM approval_requests ar
             JOIN approval_steps st ON ar.id = st.request_id AND st.step_number = ar.current_step_index
             JOIN users u ON ar.requester_id = u.id
             JOIN organizations o ON ar.organization_id = o.id
             LEFT JOIN files f ON ar.file_id = f.id
             LEFT JOIN folders fd ON ar.folder_id = fd.id
             WHERE (st.approver_id = $1 OR st.approver_id IS NULL)
               AND st.status = 'pending'
               AND ar.status = 'pending'
             ORDER BY ar.created_at DESC`,
            [userId]
        );
        return result.rows;
    }

    async findSubmittedRequestsForUser(userId) {
        const result = await db.query(
            `SELECT ar.*, 
                    f.original_name as file_name, f.size as file_size, f.mime_type,
                    fd.name as folder_name, o.name as organization_name
             FROM approval_requests ar
             JOIN organizations o ON ar.organization_id = o.id
             LEFT JOIN files f ON ar.file_id = f.id
             LEFT JOIN folders fd ON ar.folder_id = fd.id
             WHERE ar.requester_id = $1
             ORDER BY ar.created_at DESC`,
            [userId]
        );
        return result.rows;
    }

    async findApprovalRequestById(id) {
        const reqRes = await db.query(
            `SELECT ar.*, u.full_name as requester_name, u.email as requester_email, u.avatar_url as requester_avatar,
                    f.original_name as file_name, f.mime_type, f.size as file_size,
                    fd.name as folder_name, o.name as organization_name
             FROM approval_requests ar
             JOIN users u ON ar.requester_id = u.id
             JOIN organizations o ON ar.organization_id = o.id
             LEFT JOIN files f ON ar.file_id = f.id
             LEFT JOIN folders fd ON ar.folder_id = fd.id
             WHERE ar.id = $1`,
            [id]
        );
        if (reqRes.rows.length === 0) return null;

        const stepsRes = await db.query(
            `SELECT st.*, u.full_name as approver_name, u.email as approver_email, u.avatar_url as approver_avatar
             FROM approval_steps st
             LEFT JOIN users u ON st.approver_id = u.id
             WHERE st.request_id = $1
             ORDER BY st.step_number ASC`,
            [id]
        );

        return { request: reqRes.rows[0], steps: stepsRes.rows };
    }

    async processStepDecision(requestId, approverId, decision, comment) {
        const client = await db.getClient();
        try {
            await client.query('BEGIN');

            const reqRes = await client.query(`SELECT * FROM approval_requests WHERE id = $1 FOR UPDATE`, [requestId]);
            const request = reqRes.rows[0];
            if (!request || request.status !== 'pending') {
                throw new Error('Approval request is not pending');
            }

            const currentStepNum = request.current_step_index;
            const now = new Date();

            // Update step status
            await client.query(
                `UPDATE approval_steps 
                 SET status = $1, approver_id = COALESCE(approver_id, $2), comment = $3, action_timestamp = $4
                 WHERE request_id = $5 AND step_number = $6`,
                [decision, approverId, comment || null, now, requestId, currentStepNum]
            );

            let newReqStatus = 'pending';
            let nextStepIndex = currentStepNum;

            if (decision === 'rejected') {
                newReqStatus = 'rejected';
            } else if (decision === 'approved') {
                const countRes = await client.query(`SELECT COUNT(*) FROM approval_steps WHERE request_id = $1`, [requestId]);
                const totalSteps = parseInt(countRes.rows[0].count, 10);

                if (currentStepNum >= totalSteps) {
                    newReqStatus = 'approved';
                } else {
                    nextStepIndex = currentStepNum + 1;
                    // Set next step status to pending
                    await client.query(
                        `UPDATE approval_steps SET status = 'pending' WHERE request_id = $1 AND step_number = $2`,
                        [requestId, nextStepIndex]
                    );
                }
            }

            const updatedReqRes = await client.query(
                `UPDATE approval_requests 
                 SET status = $1, current_step_index = $2, updated_at = $3
                 WHERE id = $4 RETURNING *`,
                [newReqStatus, nextStepIndex, now, requestId]
            );

            await client.query('COMMIT');
            return updatedReqRes.rows[0];
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }
}

module.exports = new ApprovalRepository();
