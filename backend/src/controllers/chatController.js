const TLSSigAPIv2 = require('tls-sig-api-v2');
const AppError = require('../utils/AppError');

exports.getUserSig = (req, res, next) => {
    try {
        const sdkAppId = parseInt(process.env.TENCENT_CHAT_SDK_APP_ID, 10);
        const secretKey = process.env.TENCENT_CHAT_SECRET_KEY;

        if (!sdkAppId || !secretKey) {
            return next(new AppError('Tencent Chat SDK configuration is missing', 500));
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
