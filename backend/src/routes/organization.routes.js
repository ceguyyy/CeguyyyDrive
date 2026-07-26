const express = require('express');
const organizationController = require('../controllers/organizationController');
const orgDriveRoutes = require('./orgDrive.routes');
const approvalTemplateRoutes = require('./approvalTemplate.routes');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(authMiddleware.protect);

router.use('/:orgId/drive', orgDriveRoutes);
router.use('/:orgId/approval-templates', approvalTemplateRoutes);

router.post('/', organizationController.createOrganization);
router.get('/', organizationController.getUserOrganizations);
router.post('/:orgId/invite', organizationController.inviteMember);
router.post('/:orgId/respond', organizationController.respondToInvitation);
router.get('/:orgId/members', organizationController.getMembers);
router.get('/:orgId/roles', organizationController.getRoles);
router.get('/:orgId/my-permissions', organizationController.getMyPermissions);
router.post('/:orgId/roles', organizationController.saveRoles);
router.delete('/:orgId', organizationController.deleteOrganization);
router.delete('/:orgId/members/:memberId', organizationController.removeMember);
router.patch('/:orgId/members/:memberId/storage', organizationController.updateMemberStorageLimit);
router.patch('/:orgId/members/:memberId/role', organizationController.changeMemberRole);
router.post('/:orgId/transfer-owner', organizationController.transferOwner);

// API key management for the Integration page. Owner-only, enforced in the service.
router.get('/:orgId/api-keys', organizationController.listApiKeys);
router.post('/:orgId/api-keys', organizationController.createApiKey);
router.delete('/:orgId/api-keys/:keyId', organizationController.revokeApiKey);

module.exports = router;
