const express = require('express');
const versionController = require('../controllers/versionController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(authMiddleware.protect);

// Nested under /files/:fileId/versions
router.get('/files/:fileId/versions', versionController.getVersions);
router.post('/files/:fileId/versions/finalize', versionController.finalizeNewVersion);

// Direct version operations
router.get('/versions/:id/download-url', versionController.getDownloadUrl);
router.post('/versions/:id/restore', versionController.restoreVersion);
router.delete('/versions/:id', versionController.deleteVersion);

module.exports = router;
