const approvalRepository = require('../repositories/approvalRepository');
const db = require('../config/db');

class ApprovalService {
    async submitForApproval(orgId, fileId, folderId, requesterId, title, steps) {
        if (!title || !title.trim()) {
            throw new Error('Approval request title is required');
        }
        if (!steps || !Array.isArray(steps) || steps.length === 0) {
            throw new Error('At least one approval step is required');
        }

        const result = await approvalRepository.createApprovalRequest(orgId, fileId, folderId, requesterId, title.trim(), steps);

        // Notify the first step approver (if specific approver assigned)
        const firstStep = result.steps[0];
        if (firstStep && firstStep.approver_id) {
            await db.query(
                `INSERT INTO notifications (user_id, sender_id, title, message, type, link)
                 VALUES ($1, $2, $3, $4, 'approval_request', $5)`,
                [
                    firstStep.approver_id,
                    requesterId,
                    `File Approval Request: ${title.trim()}`,
                    `A file approval request requires your sign-off as ${firstStep.role_name}.`,
                    `/approvals`
                ]
            );
        } else {
            // Notify all org members matching role or org members
            const orgMembers = await db.query(
                `SELECT user_id FROM organization_members WHERE organization_id = $1 AND status = 'accepted' AND user_id IS NOT NULL AND user_id != $2`,
                [orgId, requesterId]
            );
            for (const m of orgMembers.rows) {
                await db.query(
                    `INSERT INTO notifications (user_id, sender_id, title, message, type, link)
                     VALUES ($1, $2, $3, $4, 'approval_request', $5)`,
                    [
                        m.user_id,
                        requesterId,
                        `File Approval Request: ${title.trim()}`,
                        `A file approval request requires sign-off for role ${firstStep.role_name}.`,
                        `/approvals`
                    ]
                );
            }
        }

        return result;
    }

    async getPendingApprovals(userId) {
        return await approvalRepository.findPendingApprovalsForUser(userId);
    }

    async getSubmittedRequests(userId) {
        return await approvalRepository.findSubmittedRequestsForUser(userId);
    }

    async getApprovalDetails(id) {
        const details = await approvalRepository.findApprovalRequestById(id);
        if (!details) throw new Error('Approval request not found');
        return details;
    }

    async processDecision(requestId, approverId, decision, comment) {
        if (!['approved', 'rejected'].includes(decision)) {
            throw new Error('Decision must be approved or rejected');
        }

        const updatedReq = await approvalRepository.processStepDecision(requestId, approverId, decision, comment);

        // Notify requester about step decision
        const statusText = updatedReq.status === 'approved' ? 'fully approved ✓' : updatedReq.status === 'rejected' ? 'rejected ❌' : 'moved to the next approver step';
        await db.query(
            `INSERT INTO notifications (user_id, sender_id, title, message, type, link)
             VALUES ($1, $2, $3, $4, 'approval_update', $5)`,
            [
                updatedReq.requester_id,
                approverId,
                `Approval Request Update: ${updatedReq.title}`,
                `Your approval request for "${updatedReq.title}" has been ${statusText}.`,
                `/approvals`
            ]
        );

        return updatedReq;
    }
}

module.exports = new ApprovalService();
