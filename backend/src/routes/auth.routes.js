const express = require('express');
const authController = require('../controllers/authController');

const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/verify-otp', authController.verifyOtp);
router.get('/me', authMiddleware.protect, authController.getMe);

module.exports = router;
