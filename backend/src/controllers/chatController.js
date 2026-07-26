const TLSSigAPIv2 = require('tls-sig-api-v2');
const organizationRepository = require('../repositories/organizationRepository');
const AppError = require('../utils/AppError');

exports.getUserSig = async (req, res, next) => {
    try {
        const sdkAppId = parseInt(process.env.TENCENT_CHAT_SDK_APP_ID, 10);
        const secretKey = process.env.TENCENT_CHAT_SECRET_KEY;

        if (!sdkAppId || !secretKey) {
            return next(new AppError('Tencent Chat SDK configuration is missing', 500));
        }

        const orgs = await organizationRepository.findUserOrganizations(req.user.id);
        const activeChatOrgs = orgs.filter(o => o.status !== 'suspended' && o.feature_chat_enabled !== false);
        if (orgs.length > 0 && activeChatOrgs.length === 0) {
            return next(new AppError('Team Chat feature is disabled or suspended for your organization(s) by the Billing Administrator.', 403));
        }

        const userId = String(req.user.id);
        const expireTime = 86400 * 7; // 7 days in seconds

        const api = new TLSSigAPIv2.Api(sdkAppId, secretKey);
        const userSig = api.genSig(userId, expireTime);

        res.status(200).json({
            status: 'success',
            data: {
                userId,
                userSig,
                sdkAppId
            }
        });
    } catch (err) {
        next(err);
    }
};
