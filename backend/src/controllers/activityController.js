const activityService = require('../services/activityService');

exports.getActivities = async (req, res, next) => {
    try {
        const logs = await activityService.getActivityTimeline(req.user.id);
        
        res.status(200).json({
            status: 'success',
            data: { logs }
        });
    } catch (err) {
        next(err);
    }
};
