const tencentcloud = require('tencentcloud-sdk-nodejs-captcha');
const CaptchaClient = tencentcloud.captcha.v20190722.Client;

exports.verifyCaptcha = async (ticket, randstr, userIp) => {
    if (!ticket || !randstr) {
        return false;
    }

    const appId = parseInt(process.env.CAPTCHA_APP_ID, 10);
    const appSecretKey = process.env.CAPTCHA_SECRET_KEY;
    const secretId = process.env.TENCENT_SECRET_ID;
    const secretKey = process.env.TENCENT_SECRET_KEY;

    try {
        const client = new CaptchaClient({
            credential: {
                secretId: secretId,
                secretKey: secretKey,
            },
            region: "",
            profile: {
                httpProfile: {
                    endpoint: "captcha.intl.tencentcloudapi.com",
                },
            },
        });

        const response = await client.DescribeCaptchaResult({
            CaptchaType: 9,
            Ticket: ticket,
            UserIp: userIp || '127.0.0.1',
            Randstr: randstr,
            CaptchaAppId: appId,
            AppSecretKey: appSecretKey
        });

        if (response.CaptchaCode === 1) {
            return true;
        }

        console.error("Captcha verification failed:", response);
        return response.CaptchaMsg || `Captcha verification failed (Code: ${response.CaptchaCode})`;
    } catch (err) {
        console.error("Captcha API Error:", err);
        return err.message || 'Captcha verification failed due to network error';
    }
};
