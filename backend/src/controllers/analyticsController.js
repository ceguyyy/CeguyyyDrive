const analyticsService = require('../services/analyticsService');

exports.getStorageDashboard = async (req, res, next) => {
    try {
        const stats = await analyticsService.getStorageStats(req.user.id);
        
        res.status(200).json({
            status: 'success',
            data: stats
        });
    } catch (err) {
        next(err);
    }
};
