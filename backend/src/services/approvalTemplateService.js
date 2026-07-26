const approvalTemplateRepository = require('../repositories/approvalTemplateRepository');
const AppError = require('../utils/AppError');

class ApprovalTemplateService {
    async createTemplate(orgId, name, createdBy, steps, revisionPolicy = 'restart') {
        if (!name || !name.trim()) {
            throw new AppError('Template name is required', 400);
        }
        if (!Array.isArray(steps) || steps.length === 0) {
            throw new AppError('Template must contain at least one approval step', 400);
        }
        return await approvalTemplateRepository.createTemplate(orgId, name.trim(), createdBy, steps, revisionPolicy);
    }

    async getTemplatesByOrg(orgId) {
        return await approvalTemplateRepository.getTemplatesByOrg(orgId);
    }

    async updateTemplate(orgId, templateId, name, steps, revisionPolicy = null) {
        if (!name || !name.trim()) {
            throw new AppError('Template name is required', 400);
        }
        if (!Array.isArray(steps) || steps.length === 0) {
            throw new AppError('Template must contain at least one approval step', 400);
        }
        const updated = await approvalTemplateRepository.updateTemplate(orgId, templateId, name.trim(), steps, revisionPolicy);
        if (!updated) {
            throw new AppError('Template not found', 404);
        }
        return updated;
    }

    async deleteTemplate(orgId, templateId) {
        const deleted = await approvalTemplateRepository.deleteTemplate(orgId, templateId);
        if (!deleted) {
            throw new AppError('Template not found', 404);
        }
        return deleted;
    }
}

module.exports = new ApprovalTemplateService();
