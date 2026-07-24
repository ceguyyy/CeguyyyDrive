const express = require('express');
const shareController = require('../controllers/shareController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

// 1. PUBLIC ROUTE
router.get('/public/:token', shareController.accessSharedResource);

// 2. PROTECTED ROUTES
router.use(authMiddleware.protect);

router.post('/', shareController.generateShareLink);
router.get('/', shareController.listShares);
router.get('/received', shareController.getSharedWithMe);
router.get('/sent', shareController.getSharedByMe);
router.delete('/received/:id', shareController.removeReceivedShare);
router.get('/:token', shareController.accessSharedResource);
router.patch('/:id', shareController.updateShareExpiration);
router.delete('/:id', shareController.revokeShare);

module.exports = router;
