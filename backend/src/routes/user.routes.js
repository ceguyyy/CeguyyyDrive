const express = require('express');
const userController = require('../controllers/userController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

router.put('/profile', authMiddleware.protect, userController.updateProfile);
router.put('/password', authMiddleware.protect, userController.updatePassword);
router.get('/search', authMiddleware.protect, userController.searchUsers);

module.exports = router;
