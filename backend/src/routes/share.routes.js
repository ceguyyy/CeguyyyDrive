const express = require('express');
const shareController = require('../controllers/shareController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

// 1. PUBLIC ROUTE
// Access a shared resource via token. Does NOT require authentication.
router.get('/public/:token', shareController.accessSharedResource);

// 2. PROTECTED ROUTES
router.use(authMiddleware.protect);

router.post('/', shareController.generateShareLink);
router.get('/', shareController.listShares); // Uses query params ?fileId= or ?folderId=
router.get('/received', shareController.getSharedWithMe); // Shared with current user
router.get('/:token', shareController.accessSharedResource);
router.delete('/:id', shareController.revokeShare);

module.exports = router;
