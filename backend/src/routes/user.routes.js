const express = require('express');
const userController = require('../controllers/userController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

router.put('/profile', authMiddleware.protect, userController.updateProfile);
router.put('/password', authMiddleware.protect, userController.updatePassword);
router.get('/search', authMiddleware.protect, userController.searchUsers);

// Personal Drive API keys, for integrating your own drive rather than an
// organization's. Session-authenticated; the keys themselves are used against
// /integration/v1.
router.get('/me/api-keys', authMiddleware.protect, userController.listPersonalApiKeys);
router.post('/me/api-keys', authMiddleware.protect, userController.createPersonalApiKey);
router.delete('/me/api-keys/:keyId', authMiddleware.protect, userController.revokePersonalApiKey);

module.exports = router;
