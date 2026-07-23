const express = require('express');
const chatController = require('../controllers/chatController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/usersig', authMiddleware.protect, chatController.getUserSig);

module.exports = router;
