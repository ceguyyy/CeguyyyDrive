const express = require('express');
const shareController = require('../controllers/shareController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

// 1. PUBLIC ROUTE
// Access a shared resource via token. Does NOT require authentication.
router.get('/:token', shareController.accessSharedResource);

// 2. PROTECTED ROUTES
// Generating and revoking links requires the user to be logged in.
router.use(authMiddleware.protect);

router.post('/', shareController.generateShareLink);
router.get('/', shareController.listShares); // Uses query params ?fileId= or ?folderId=
router.delete('/:id', shareController.revokeShare);

module.exports = router;
