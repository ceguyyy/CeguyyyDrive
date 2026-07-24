const notificationRepository = require('../repositories/notificationRepository');

class NotificationService {
    async getUserNotifications(userId) {
        const notifications = await notificationRepository.findByUserId(userId);
        const unreadCount = await notificationRepository.countUnread(userId);
        return { notifications, unreadCount };
    }

    async markAsRead(id, userId) {
        return await notificationRepository.markAsRead(id, userId);
    }

    async markAllAsRead(userId) {
        await notificationRepository.markAllAsRead(userId);
    }
}

module.exports = new NotificationService();
