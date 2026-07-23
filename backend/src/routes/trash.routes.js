const express = require('express');
const trashController = require('../controllers/trashController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(authMiddleware.protect);

router.get('/', trashController.getTrash);
router.post('/restore', trashController.restoreItem);
router.delete('/empty', trashController.emptyTrash);

module.exports = router;
