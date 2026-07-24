const notificationService = require('../services/notificationService');

exports.getNotifications = async (req, res, next) => {
    try {
        const data = await notificationService.getUserNotifications(req.user.id);
        res.status(200).json({
            status: 'success',
            data
        });
    } catch (err) {
        next(err);
    }
};

exports.markAsRead = async (req, res, next) => {
    try {
        const notification = await notificationService.markAsRead(req.params.id, req.user.id);
        res.status(200).json({
            status: 'success',
            data: { notification }
        });
    } catch (err) {
        next(err);
    }
};

exports.markAllAsRead = async (req, res, next) => {
    try {
        await notificationService.markAllAsRead(req.user.id);
        res.status(200).json({
            status: 'success',
            message: 'All notifications marked as read'
        });
    } catch (err) {
        next(err);
    }
};
