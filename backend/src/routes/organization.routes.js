const express = require('express');
const organizationController = require('../controllers/organizationController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(authMiddleware.protect);

router.post('/', organizationController.createOrganization);
router.get('/', organizationController.getUserOrganizations);
router.post('/:orgId/invite', organizationController.inviteMember);
router.post('/:orgId/respond', organizationController.respondToInvitation);
router.get('/:orgId/members', organizationController.getMembers);
router.get('/:orgId/roles', organizationController.getRoles);
router.post('/:orgId/roles', organizationController.saveRoles);
router.delete('/:orgId', organizationController.deleteOrganization);
router.delete('/:orgId/members/:memberId', organizationController.removeMember);
router.post('/:orgId/transfer-owner', organizationController.transferOwner);

module.exports = router;
