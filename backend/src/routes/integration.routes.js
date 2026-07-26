const express = require('express');
const integrationController = require('../controllers/integrationController');
const apiKeyMiddleware = require('../middlewares/apiKeyMiddleware');
const {
    SCOPE_READ,
    SCOPE_WRITE,
    SCOPE_ORG_READ,
    SCOPE_MEMBERS_WRITE,
    SCOPE_APPROVALS_READ,
    SCOPE_APPROVALS_WRITE
} = require('../services/apiKeyService');

const router = express.Router();

// API-key authenticated, never JWT. The organization comes from the key.
router.use(apiKeyMiddleware.authenticate);

router.get('/whoami', integrationController.whoami);

/* ── Company Drive ─────────────────────────────────────────────────────── */
router.get('/folders', apiKeyMiddleware.requireScope(SCOPE_READ), integrationController.listContents);
router.get('/folders/:folderId', apiKeyMiddleware.requireScope(SCOPE_READ), integrationController.listContents);
router.get('/files/:fileId/download-url', apiKeyMiddleware.requireScope(SCOPE_READ), integrationController.createDownloadUrl);

router.post('/folders', apiKeyMiddleware.requireScope(SCOPE_WRITE), integrationController.createFolder);
router.post('/files/upload-url', apiKeyMiddleware.requireScope(SCOPE_WRITE), integrationController.createUploadUrl);

/* ── Organization ──────────────────────────────────────────────────────── */
router.get('/organization', apiKeyMiddleware.requireOrganizationKey, apiKeyMiddleware.requireScope(SCOPE_ORG_READ), integrationController.getOrganization);
router.get('/organization/members', apiKeyMiddleware.requireOrganizationKey, apiKeyMiddleware.requireScope(SCOPE_ORG_READ), integrationController.listMembers);
router.get('/organization/roles', apiKeyMiddleware.requireOrganizationKey, apiKeyMiddleware.requireScope(SCOPE_ORG_READ), integrationController.listRoles);

// Its own scope: adding people to an organization is the one write here that
// changes who can reach the data, so it is never granted by a read-only key.
router.post('/organization/members', apiKeyMiddleware.requireOrganizationKey, apiKeyMiddleware.requireScope(SCOPE_MEMBERS_WRITE), integrationController.inviteMember);

/* ── Approvals ─────────────────────────────────────────────────────────── */
router.get('/approval-templates', apiKeyMiddleware.requireOrganizationKey, apiKeyMiddleware.requireScope(SCOPE_APPROVALS_READ), integrationController.listApprovalTemplates);
router.get('/approvals/pending', apiKeyMiddleware.requireOrganizationKey, apiKeyMiddleware.requireScope(SCOPE_APPROVALS_READ), integrationController.listPendingApprovals);
router.get('/approvals/submitted', apiKeyMiddleware.requireOrganizationKey, apiKeyMiddleware.requireScope(SCOPE_APPROVALS_READ), integrationController.listSubmittedRequests);
router.get('/approvals/:requestId', apiKeyMiddleware.requireOrganizationKey, apiKeyMiddleware.requireScope(SCOPE_APPROVALS_READ), integrationController.getApprovalDetails);

router.post('/approvals', apiKeyMiddleware.requireOrganizationKey, apiKeyMiddleware.requireScope(SCOPE_APPROVALS_WRITE), integrationController.submitForApproval);
router.post('/approvals/:requestId/decision', apiKeyMiddleware.requireOrganizationKey, apiKeyMiddleware.requireScope(SCOPE_APPROVALS_WRITE), integrationController.decideApproval);
router.post('/approvals/:requestId/resubmit', apiKeyMiddleware.requireOrganizationKey, apiKeyMiddleware.requireScope(SCOPE_APPROVALS_WRITE), integrationController.resubmitAfterRevision);

module.exports = router;
