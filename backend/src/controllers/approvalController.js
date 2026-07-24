const approvalService = require('../services/approvalService');

exports.submitForApproval = async (req, res, next) => {
    try {
        const { orgId, fileId, folderId, title, steps } = req.body;
        const result = await approvalService.submitForApproval(orgId, fileId, folderId, req.user.id, title, steps);
        res.status(201).json({ status: 'success', data: result });
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

exports.processDecision = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { decision, comment } = req.body;
        const updated = await approvalService.processDecision(id, req.user.id, decision, comment);
        res.status(200).json({ status: 'success', data: { request: updated } });
    } catch (err) {
        next(err);
    }
};
