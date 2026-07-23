const analyticsRepository = require('../repositories/analyticsRepository');

class AnalyticsService {
    async getStorageStats(userId) {
        const [totalBytes, breakdown] = await Promise.all([
            analyticsRepository.getTotalStorageUsed(userId),
            analyticsRepository.getStorageBreakdownByType(userId)
        ]);

        return {
            totalBytes: parseInt(totalBytes, 10),
            breakdown: breakdown.map(b => ({
                category: b.category,
                totalBytes: parseInt(b.total_bytes, 10)
            }))
        };
    }
}

module.exports = new AnalyticsService();
