const axios = require('axios');

class TelegramService {
    constructor() {
        this.botToken = process.env.TELEGRAM_BOT_TOKEN;
        this.chatId = process.env.TELEGRAM_CHAT_ID;
    }

    async sendOtpMessage(email, otpCode) {
        const text = `🔐 *CeguyyyDrive Login OTP*\n\nUser: \`${email}\`\nOTP Code: *${otpCode}*\n\n⏳ Valid for 5 minutes.`;

        if (!this.botToken || !this.chatId) {
            console.log('\n======================================================');
            console.log(`[TELEGRAM OTP DEV FALLBACK] User: ${email} | OTP: ${otpCode}`);
            console.log('======================================================\n');
            return true;
        }

        try {
            const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
            await axios.post(url, {
                chat_id: this.chatId,
                text: text,
                parse_mode: 'Markdown'
            });
            return true;
        } catch (err) {
            console.error('[Telegram API Error]:', err.response?.data || err.message);
            // Fallback log so dev/test is never blocked if Telegram API fails
            console.log(`[TELEGRAM OTP FALLBACK LOG] User: ${email} | OTP: ${otpCode}`);
            return true;
        }
    }
}

module.exports = new TelegramService();
