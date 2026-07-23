const express = require('express');
const folderController = require('../controllers/folderController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

// All folder routes require authentication
router.use(authMiddleware.protect);

router.route('/')
    .post(folderController.createFolder)
    .get(folderController.listFolders);

router.route('/:id')
    .get(folderController.getFolder)
    .put(folderController.updateFolder)
    .delete(folderController.deleteFolder);

router.post('/:id/copy', folderController.copyFolder);

module.exports = router;
