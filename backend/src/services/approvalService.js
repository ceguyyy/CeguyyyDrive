const approvalRepository = require('../repositories/approvalRepository');
const AppError = require('../utils/AppError');
const db = require('../config/db');
const pdfService = require('../utils/pdfService');
const cosService = require('./cosService');

class ApprovalService {
    async ensureFileIsPdf(fileId) {
        if (!fileId) return;
        try {
            const fileRes = await db.query('SELECT * FROM files WHERE id = $1', [fileId]);
            const file = fileRes.rows[0];
            if (!file) return;

            const storageKey = file.storage_key || file.object_key;
            const buffer = await cosService.getObjectBuffer(storageKey);
            const { buffer: pdfBuffer, mimeType, fileName } = await pdfService.convertToPdfIfNeeded(buffer, file.mime_type, file.original_name);

            if (mimeType !== file.mime_type || pdfBuffer.length !== buffer.length || fileName !== file.original_name) {
                await cosService.putObjectBuffer(storageKey, pdfBuffer, 'application/pdf');
                await db.query(
                    'UPDATE files SET mime_type = $1, original_name = $2, size = $3 WHERE id = $4',
                    ['application/pdf', fileName, pdfBuffer.length, file.id]
                );
            }
        } catch (err) {
            console.warn('ensureFileIsPdf warning (possibly mock/missing file in storage):', err.message || err);
        }
    }

    async submitForApproval(orgId, fileId, folderId, requesterId, title, steps, revisionPolicy = 'restart') {
        if (!title || !title.trim()) {
            throw new AppError('Approval request title is required', 400);
        }
        if (!steps || !Array.isArray(steps) || steps.length === 0) {
            throw new AppError('At least one approval step is required', 400);
        }

        if (fileId) {
            await this.ensureFileIsPdf(fileId);
        }

        const result = await approvalRepository.createApprovalRequest(orgId, fileId, folderId, requesterId, title.trim(), steps, revisionPolicy);

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

    async getPreviewUrl(id, userId, fileIdParam = null) {
        let fileId = fileIdParam;
        if (!fileId) {
            const details = await this.getApprovalDetails(id);
            fileId = details.request?.file_id || details.file_id;
        } else {
            const checkRes = await db.query(
                `SELECT 1 FROM approval_requests WHERE id = $1 AND file_id = $2
                 UNION
                 SELECT 1 FROM approval_audit_logs WHERE request_id = $1 AND file_id = $2`,
                [id, fileId]
            );
            if (checkRes.rows.length === 0) {
                throw new AppError('This file is not associated with the specified approval request', 403);
            }
        }
        if (!fileId) {
            throw new AppError('No file is attached to this approval request', 404);
        }
        const fileRes = await db.query('SELECT * FROM files WHERE id = $1', [fileId]);
        const file = fileRes.rows[0];
        if (!file) {
            throw new AppError('Attached file not found in storage', 404);
        }
        const storageKey = file.storage_key || file.object_key;
        const url = await cosService.getPresignedDownloadUrl(storageKey, true, file.mime_type || 'application/pdf');
        return { url, fileName: file.original_name, mimeType: file.mime_type };
    }

    async processDecision(requestId, approverId, decision, comment, signatureBase64 = null) {
        if (!['approved', 'rejected', 'needs_revision'].includes(decision)) {
            throw new AppError('Decision must be approved, rejected, or needs_revision', 400);
        }
        // Sending work back is useless without saying why.
        if (decision === 'needs_revision' && (!comment || !comment.trim())) {
            throw new AppError('Explain what needs changing when requesting a revision', 400);
        }
        if (decision === 'approved' && (!signatureBase64 || !signatureBase64.trim())) {
            throw new AppError('An E-Signature (drawn or uploaded image) is required to approve this document.', 400);
        }

        const updatedReq = await approvalRepository.processStepDecision(requestId, approverId, decision, comment, signatureBase64);

        if (decision === 'approved' && updatedReq.file_id) {
            try {
                const fileRes = await db.query('SELECT * FROM files WHERE id = $1', [updatedReq.file_id]);
                const file = fileRes.rows[0];
                if (file) {
                    const reqUserRes = await db.query('SELECT full_name, email FROM users WHERE id = $1', [updatedReq.requester_id]);
                    const appUserRes = await db.query('SELECT full_name, email FROM users WHERE id = $1', [approverId]);
                    const reqUser = reqUserRes.rows[0] || {};
                    const appUser = appUserRes.rows[0] || {};

                    const requesterName = reqUser.full_name || reqUser.email || 'Requestor';
                    const approverName = appUser.full_name || appUser.email || 'Approver';

                    const stepRes = await db.query('SELECT role_name FROM approval_steps WHERE request_id = $1 AND approver_id = $2 AND status = $3 ORDER BY step_number DESC LIMIT 1', [requestId, approverId, 'approved']);
                    const approverRole = stepRes.rows[0]?.role_name || 'Approver';

                    const storageKey = file.storage_key || file.object_key;
                    const pdfBuffer = await cosService.getObjectBuffer(storageKey);
                    const signedBuffer = await pdfService.embedSignatureAndWatermark(pdfBuffer, {
                        requesterName,
                        approverName,
                        approverRole,
                        signatureBase64,
                        dateStr: new Date().toLocaleString()
                    });

                    await cosService.putObjectBuffer(storageKey, signedBuffer, 'application/pdf');
                    await db.query('UPDATE files SET size = $1, mime_type = $2 WHERE id = $3', [signedBuffer.length, 'application/pdf', file.id]);
                }
            } catch (sigErr) {
                console.error('Error embedding signature and watermark into PDF:', sigErr);
            }
        }

        // Notify requester about step decision
        const statusText = updatedReq.status === 'approved' ? 'fully approved ✓'
            : updatedReq.status === 'rejected' ? 'rejected ❌'
            : updatedReq.status === 'needs_revision' ? 'sent back for revision ✏️'
            : 'moved to the next approver step';
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

    async resubmitAfterRevision(requestId, requesterId, newFileId = null) {
        if (!newFileId) {
            throw new AppError('You must upload and select a revised file to resubmit this approval request.', 400);
        }
        await this.ensureFileIsPdf(newFileId);
        const updated = await approvalRepository.resubmitAfterRevision(requestId, requesterId, newFileId);
        const details = await approvalRepository.findApprovalRequestById(requestId);
        const activeStep = details?.steps.find(s => s.step_number === updated.current_step_index);

        const policyNote = updated.revision_policy === 'resume'
            ? 'Review resumes from the step that requested changes.'
            : 'All approvers will review it again from the first step.';

        if (activeStep?.approver_id) {
            await db.query(
                `INSERT INTO notifications (user_id, sender_id, title, message, type, link)
                 VALUES ($1, $2, $3, $4, 'approval_request', $5)`,
                [
                    activeStep.approver_id,
                    requesterId,
                    `Revised and resubmitted: ${updated.title}`,
                    `A revised file needs your sign-off as ${activeStep.role_name}. ${policyNote}`,
                    `/approvals`
                ]
            );
        } else if (activeStep) {
            const orgMembers = await db.query(
                `SELECT user_id FROM organization_members WHERE organization_id = $1 AND status = 'accepted' AND user_id IS NOT NULL AND user_id != $2`,
                [updated.organization_id, requesterId]
            );
            for (const m of orgMembers.rows) {
                await db.query(
                    `INSERT INTO notifications (user_id, sender_id, title, message, type, link)
                     VALUES ($1, $2, $3, $4, 'approval_request', $5)`,
                    [
                        m.user_id,
                        requesterId,
                        `Revised and resubmitted: ${updated.title}`,
                        `A revised file needs sign-off for role ${activeStep.role_name}. ${policyNote}`,
                        `/approvals`
                    ]
                );
            }
        }

        return updated;
    }
}

module.exports = new ApprovalService();
