const orgDriveService = require('../services/orgDriveService');
const organizationService = require('../services/organizationService');
const organizationRepository = require('../repositories/organizationRepository');
const approvalService = require('../services/approvalService');
const approvalTemplateService = require('../services/approvalTemplateService');

// The public integration surface. Every handler acts on req.apiKey.organizationId
// -- never on an id from the URL or body -- so a key cannot be pointed at
// another organization by changing the request.
//
// Deliberately absent: billing, role-hierarchy edits, member removal, and
// organization deletion. Those stay behind an interactive session.

/* ── Drive ─────────────────────────────────────────────────────────────── */

exports.listContents = async (req, res, next) => {
    try {
        const { organizationId, userId } = req.apiKey;
        const contents = await orgDriveService.listDriveContents(
            organizationId, req.params.folderId || null, userId
        );
        res.status(200).json({ status: 'success', data: contents });
    } catch (err) {
        next(err);
    }
};

exports.createFolder = async (req, res, next) => {
    try {
        const { organizationId, userId } = req.apiKey;
        const { name, parentFolderId } = req.body;
        const folder = await orgDriveService.createSubfolder(
            organizationId, name, parentFolderId || null, userId
        );
        res.status(201).json({ status: 'success', data: { folder } });
    } catch (err) {
        next(err);
    }
};

// Uploads are two-step, matching the browser client: this returns a presigned
// URL, and the caller PUTs the bytes straight to object storage.
exports.createUploadUrl = async (req, res, next) => {
    try {
        const { organizationId, userId } = req.apiKey;
        const { fileName, size, mimeType, folderId } = req.body;
        const result = await orgDriveService.generateUploadUrl(
            organizationId, fileName, size, mimeType, folderId || null, userId
        );
        res.status(200).json({ status: 'success', data: result });
    } catch (err) {
        next(err);
    }
};

exports.createDownloadUrl = async (req, res, next) => {
    try {
        const { organizationId, userId } = req.apiKey;
        const result = await orgDriveService.generateDownloadUrl(
            organizationId, req.params.fileId, userId
        );
        res.status(200).json({ status: 'success', data: result });
    } catch (err) {
        next(err);
    }
};

/* ── Organization ──────────────────────────────────────────────────────── */

exports.getOrganization = async (req, res, next) => {
    try {
        const org = await organizationRepository.findOrganizationById(req.apiKey.organizationId);
        if (!org) return res.status(404).json({ status: 'error', message: 'Organization not found' });

        // Billing internals are not part of the integration contract.
        const { license_key, billing_notes, ...safe } = org;
        res.status(200).json({ status: 'success', data: { organization: safe } });
    } catch (err) {
        next(err);
    }
};

exports.listMembers = async (req, res, next) => {
    try {
        const members = await organizationService.getMembers(req.apiKey.organizationId);
        res.status(200).json({ status: 'success', data: { members } });
    } catch (err) {
        next(err);
    }
};

exports.listRoles = async (req, res, next) => {
    try {
        const roles = await organizationService.getRoles(req.apiKey.organizationId);
        res.status(200).json({ status: 'success', data: { roles } });
    } catch (err) {
        next(err);
    }
};

// Runs through organizationService, so the same hierarchy rule that governs the
// UI applies: the key's user can only invite at roles below their own, and never
// as Owner.
exports.inviteMember = async (req, res, next) => {
    try {
        const { organizationId, userId } = req.apiKey;
        const { email, roleName } = req.body;
        const member = await organizationService.inviteMember(organizationId, userId, email, roleName);
        res.status(201).json({ status: 'success', data: { member } });
    } catch (err) {
        next(err);
    }
};

/* ── Approvals ─────────────────────────────────────────────────────────── */

exports.listApprovalTemplates = async (req, res, next) => {
    try {
        const templates = await approvalTemplateService.getTemplatesByOrg(req.apiKey.organizationId);
        res.status(200).json({ status: 'success', data: { templates } });
    } catch (err) {
        next(err);
    }
};

exports.submitForApproval = async (req, res, next) => {
    try {
        const { organizationId, userId } = req.apiKey;
        const { fileId, folderId, title, steps, revisionPolicy } = req.body;
        const request = await approvalService.submitForApproval(
            organizationId, fileId || null, folderId || null, userId, title, steps, revisionPolicy || 'restart'
        );
        res.status(201).json({ status: 'success', data: { request } });
    } catch (err) {
        next(err);
    }
};

exports.listPendingApprovals = async (req, res, next) => {
    try {
        const requests = await approvalService.getPendingApprovals(req.apiKey.userId);
        res.status(200).json({ status: 'success', data: { requests } });
    } catch (err) {
        next(err);
    }
};

exports.listSubmittedRequests = async (req, res, next) => {
    try {
        const requests = await approvalService.getSubmittedRequests(req.apiKey.userId);
        res.status(200).json({ status: 'success', data: { requests } });
    } catch (err) {
        next(err);
    }
};

exports.getApprovalDetails = async (req, res, next) => {
    try {
        const request = await approvalService.getApprovalDetails(req.params.requestId);
        if (!request || request.organization_id !== req.apiKey.organizationId) {
            return res.status(404).json({ status: 'error', message: 'Approval request not found' });
        }
        res.status(200).json({ status: 'success', data: { request } });
    } catch (err) {
        next(err);
    }
};

// Covers approve, reject, and request-revision: the underlying service already
// treats them as one decision with different values.
exports.decideApproval = async (req, res, next) => {
    try {
        const { decision, comment, signatureBase64 } = req.body;
        const result = await approvalService.processDecision(
            req.params.requestId, req.apiKey.userId, decision, comment, signatureBase64 || null
        );
        res.status(200).json({ status: 'success', data: { request: result } });
    } catch (err) {
        next(err);
    }
};

exports.resubmitAfterRevision = async (req, res, next) => {
    try {
        const { newFileId } = req.body;
        const result = await approvalService.resubmitAfterRevision(
            req.params.requestId, req.apiKey.userId, newFileId || null
        );
        res.status(200).json({ status: 'success', data: { request: result } });
    } catch (err) {
        next(err);
    }
};

/* ── Diagnostics ───────────────────────────────────────────────────────── */

// Lets an integrator confirm a key works, and which organization and scopes it
// carries, without touching any data.
exports.whoami = async (req, res) => {
    const { organizationId, scopes } = req.apiKey;
    res.status(200).json({ status: 'success', data: { organizationId, scopes } });
};
