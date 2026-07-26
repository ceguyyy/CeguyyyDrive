const approvalService = require('../services/approvalService');
const organizationRepository = require('../repositories/organizationRepository');
const AppError = require('../utils/AppError');

exports.submitForApproval = async (req, res, next) => {
    try {
        const { orgId, fileId, folderId, title, steps, revisionPolicy } = req.body;
        const org = await organizationRepository.findOrganizationById(orgId);
        if (!org) {
            return next(new AppError('Organization not found', 404));
        }
        if (org.status === 'suspended' || org.feature_approval_enabled === false) {
            return next(new AppError('Approval Workflows feature is disabled or suspended for this organization by the Billing Administrator.', 403));
        }
        const result = await approvalService.submitForApproval(orgId, fileId, folderId, req.user.id, title, steps, revisionPolicy);
        res.status(201).json({ status: 'success', data: result });
    } catch (err) {
        next(err);
    }
};

exports.resubmitAfterRevision = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { fileId } = req.body;
        const request = await approvalService.resubmitAfterRevision(id, req.user.id, fileId);
        res.status(200).json({ status: 'success', data: { request } });
    } catch (err) {
        next(err);
    }
};

exports.getPendingApprovals = async (req, res, next) => {
    try {
        const pending = await approvalService.getPendingApprovals(req.user.id);
        res.status(200).json({ status: 'success', data: { pending } });
    } catch (err) {
        next(err);
    }
};

exports.getSubmittedRequests = async (req, res, next) => {
    try {
        const submitted = await approvalService.getSubmittedRequests(req.user.id);
        res.status(200).json({ status: 'success', data: { submitted } });
    } catch (err) {
        next(err);
    }
};

exports.getApprovalDetails = async (req, res, next) => {
    try {
        const { id } = req.params;
        const details = await approvalService.getApprovalDetails(id);
        res.status(200).json({ status: 'success', data: details });
    } catch (err) {
        next(err);
    }
};

exports.getPreviewUrl = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { fileId } = req.query;
        const result = await approvalService.getPreviewUrl(id, req.user.id, fileId);
        res.status(200).json({ status: 'success', data: result });
    } catch (err) {
        next(err);
    }
};

exports.processDecision = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { decision, comment, signature } = req.body;
        const updated = await approvalService.processDecision(id, req.user.id, decision, comment, signature);
        res.status(200).json({ status: 'success', data: { request: updated } });
    } catch (err) {
        next(err);
    }
};
