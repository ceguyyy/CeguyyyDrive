const express = require('express');
const cosController = require('../controllers/cosController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(authMiddleware.protect);

router.post('/upload-url', cosController.generateUploadUrl);
router.post('/upload-profile-picture-url', cosController.generateProfilePictureUploadUrl);
router.post('/upload-branding-logo-url', cosController.generateBrandingLogoUploadUrl);
router.get('/download-url/:fileId', cosController.generateDownloadUrl);
router.post('/upload-version-url/:fileId', cosController.generateVersionUploadUrl);

module.exports = router;
