const express = require('express');
const orgDriveController = require('../controllers/orgDriveController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router({ mergeParams: true });

router.use(authMiddleware.protect);

// Folders & Drive listing
router.get('/folders', orgDriveController.listDriveContents);
router.get('/folders/:folderId', orgDriveController.listDriveContents);
router.post('/folders', orgDriveController.createSubfolder);
router.patch('/folders/:id', orgDriveController.renameFolder);
router.put('/folders/:id', orgDriveController.renameFolder);
router.delete('/folders/:id', orgDriveController.softDeleteFolder);

// Files
router.post('/upload-url', orgDriveController.generateUploadUrl);
router.get('/download-url/:fileId', orgDriveController.generateDownloadUrl);
router.patch('/files/:id', orgDriveController.renameFile);
router.put('/files/:id', orgDriveController.renameFile);
router.delete('/files/:id', orgDriveController.softDeleteFile);

// Cross-drive copy
router.post('/copy-from-personal', orgDriveController.copyFromPersonal);
router.post('/files/:fileId/copy-to-personal', orgDriveController.copyToPersonal);

// Trash
router.get('/trash', orgDriveController.getTrashedItems);
router.post('/trash/:type/:id/restore', orgDriveController.restoreItem);

module.exports = router;
