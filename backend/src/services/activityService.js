const activityRepository = require('../repositories/activityRepository');

class ActivityService {
    // This is meant to be called asynchronously without awaiting if possible 
    // to prevent blocking main workflows.
    async logActivity(userId, action, targetType, targetId, details = {}) {
        try {
            await activityRepository.createLog(userId, action, targetType, targetId, details);
        } catch (err) {
            console.error('[ActivityService] Failed to log activity:', err);
            // We intentionally do not throw here to prevent failing the primary transaction
        }
    }

    async getActivityTimeline(userId) {
        // Fetch the last 50 activities
        return await activityRepository.getUserActivityLogs(userId, 50, 0);
    }
}

module.exports = new ActivityService();
