const express = require('express');
const authRoutes = require('./auth.routes');
const folderRoutes = require('./folder.routes');
const fileRoutes = require('./file.routes');
const cosRoutes = require('./cos.routes');
const chatRoutes = require('./chat.routes');
const trashRoutes = require('./trash.routes');
const shareRoutes = require('./share.routes');
const searchRoutes = require('./search.routes');
const versionRoutes = require('./version.routes');
const analyticsRoutes = require('./analytics.routes');
const activityRoutes = require('./activity.routes');
const userRoutes = require('./user.routes');
const notificationRoutes = require('./notification.routes');
const organizationRoutes = require('./organization.routes');
const approvalRoutes = require('./approval.routes');
const billingRoutes = require('./billing.routes');

const router = express.Router();

router.get('/health', (req, res) => {
    res.status(200).json({
        status: 'success',
        message: 'CeguyyyDrive API is running smoothly.'
    });
});

router.use('/auth', authRoutes);
router.use('/folders', folderRoutes);
router.use('/files', fileRoutes);
router.use('/storage', cosRoutes);
router.use('/chat', chatRoutes);
router.use('/trash', trashRoutes);
router.use('/shares', shareRoutes);
router.use('/search', searchRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/activity', activityRoutes);
router.use('/users', userRoutes);
router.use('/notifications', notificationRoutes);
router.use('/organizations', organizationRoutes);
router.use('/approvals', approvalRoutes);
router.use('/billing', billingRoutes);
router.use('/', versionRoutes); // Mounts /files/:fileId/versions and /versions/:id

module.exports = router;
