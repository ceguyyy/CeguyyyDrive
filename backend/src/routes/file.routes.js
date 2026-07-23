const express = require('express');
const fileController = require('../controllers/fileController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

// All file routes require authentication
router.use(authMiddleware.protect);

router.route('/')
    .post(fileController.createFileRecord)
    .get(fileController.listFiles);

router.route('/:id')
    .get(fileController.getFile)
    .put(fileController.updateFile)
    .delete(fileController.deleteFile);

router.post('/:id/copy', fileController.copyFile);

module.exports = router;
