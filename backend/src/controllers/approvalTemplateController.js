const approvalTemplateService = require('../services/approvalTemplateService');

exports.createTemplate = async (req, res, next) => {
    try {
        const { orgId } = req.params;
        const { name, steps } = req.body;
        const template = await approvalTemplateService.createTemplate(orgId, name, req.user.id, steps);
        res.status(201).json({
            status: 'success',
            data: { template }
        });
    } catch (err) {
        next(err);
    }
};

exports.getTemplatesByOrg = async (req, res, next) => {
    try {
        const { orgId } = req.params;
        const templates = await approvalTemplateService.getTemplatesByOrg(orgId);
        res.status(200).json({
            status: 'success',
            results: templates.length,
            data: { templates }
        });
    } catch (err) {
        next(err);
    }
};

exports.updateTemplate = async (req, res, next) => {
    try {
        const { orgId, id } = req.params;
        const { name, steps } = req.body;
        const template = await approvalTemplateService.updateTemplate(orgId, id, name, steps);
        res.status(200).json({
            status: 'success',
            data: { template }
        });
    } catch (err) {
        next(err);
    }
};

exports.deleteTemplate = async (req, res, next) => {
    try {
        const { orgId, id } = req.params;
        await approvalTemplateService.deleteTemplate(orgId, id);
        res.status(204).send();
    } catch (err) {
        next(err);
    }
};
