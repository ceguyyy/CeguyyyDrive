const express = require('express');
const billingController = require('../controllers/billingController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

// All billing routes require authentication and Super Admin ('owner', 'super_admin', 'super admin', 'admin') role
router.use(authMiddleware.protect);
router.use(authMiddleware.restrictTo('owner', 'super_admin', 'super admin', 'admin'));

router.get('/stats', billingController.getStats);

router.get('/organizations', billingController.getOrganizations);
// PUT and PATCH both accepted: the admin UI sends PUT.
router.put('/organizations/:id', billingController.updateOrganization);
router.patch('/organizations/:id', billingController.updateOrganization);
router.put('/organizations/:id/status', billingController.updateOrganizationStatus);
router.patch('/organizations/:id/status', billingController.updateOrganizationStatus);
router.delete('/organizations/:id', billingController.deleteOrganization);

router.get('/users', billingController.getManagedUsers);
router.patch('/users/:id/status', billingController.updateManagedUserStatus);

router.get('/tiers', billingController.getTiers);
router.post('/tiers', billingController.createTier);
router.put('/tiers/:id', billingController.updateTier);
router.patch('/tiers/:id', billingController.updateTier);
router.delete('/tiers/:id', billingController.deleteTier);

router.get('/licenses', billingController.getLicenses);
router.post('/licenses', billingController.createLicense);
router.delete('/licenses/:id', billingController.deleteLicense);

module.exports = router;
