const axios = require('axios');

class PlunkService {
    constructor() {
        this.apiKey = process.env.PLUNK_API_KEY;
        this.apiUrl = 'https://next-api.useplunk.com/v1/send';
    }

    async sendOtpEmail(email, otpCode) {
        const subject = `🔐 Your CeguyyyDrive Verification Code: ${otpCode}`;
        const htmlBody = `
            <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
                <div style="text-align: center; margin-bottom: 24px;">
                    <h1 style="color: #1e293b; font-size: 24px; font-weight: 700; margin: 0;">CeguyyyDrive</h1>
                    <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Secure Enterprise Cloud Storage</p>
                </div>
                <div style="background-color: #f8fafc; padding: 24px; border-radius: 8px; text-align: center; margin-bottom: 24px; border: 1px dashed #cbd5e1;">
                    <p style="color: #475569; font-size: 14px; margin: 0 0 12px 0;">Your One-Time Password (OTP) code is:</p>
                    <div style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #3b82f6; background-color: #ffffff; padding: 12px 24px; border-radius: 6px; display: inline-block; border: 1px solid #e2e8f0;">
                        ${otpCode}
                    </div>
                </div>
                <p style="color: #64748b; font-size: 14px; line-height: 1.5; margin-bottom: 24px; text-align: center;">
                    This verification code is valid for <strong>5 minutes</strong>. If you did not request this code, please ignore this email.
                </p>
                <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center;">
                    <p style="color: #94a3b8; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} CeguyyyDrive. All rights reserved.</p>
                </div>
            </div>
        `;

        const fromEmail = process.env.PLUNK_FROM_EMAIL || 'noreply@christiangunawan.my.id';
        const rawKey = process.env.PLUNK_API_KEY || this.apiKey;
        const apiKey = rawKey ? (rawKey.startsWith('Bearer ') ? rawKey.slice(7).trim() : rawKey.trim()) : null;

        if (!apiKey) {
            console.log('\n======================================================');
            console.log(`[PLUNK EMAIL OTP DEV FALLBACK] To: ${email} | OTP: ${otpCode}`);
            console.log('======================================================\n');
            return true;
        }

        try {
            await axios.post(this.apiUrl, {
                to: email,
                from: fromEmail,
                subject: subject,
                body: htmlBody
            }, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });
            console.log(`[Plunk Email Sent] OTP delivered to ${email} from ${fromEmail}`);
            return true;
        } catch (err) {
            console.error('\n❌ [Plunk API Error Details]:', JSON.stringify(err.response?.data || err.message, null, 2));
            console.log(`\n👉 [DONT WORRY! PLUNK OTP FALLBACK LOG] To: ${email} | OTP: ${otpCode}\n`);
            return true;
        }
    }

    async sendLicenseKeyEmail(email, licenseKey, planName, gmtLocation = 'GMT+7 (Asia/Jakarta)') {
        const subject = `🎉 Welcome to CeguyyyDrive! Your ${planName} Organization License Key`;
        const fromEmail = process.env.PLUNK_FROM_EMAIL || 'noreply@christiangunawan.my.id';
        const htmlBody = `
            <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
                <div style="text-align: center; margin-bottom: 24px;">
                    <h1 style="color: #1e293b; font-size: 24px; font-weight: 700; margin: 0;">CeguyyyDrive</h1>
                    <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Enterprise Workspace Provisioned</p>
                </div>
                <p style="color: #334155; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
                    Hello, your CeguyyyDrive Developer has provisioned a new <strong>${planName} Plan</strong> organization license for your account!
                </p>
                <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 24px; border: 1px solid #fde68a;">
                    <p style="color: #92400e; font-size: 13px; font-weight: 600; text-transform: uppercase; margin: 0 0 8px 0;">Your Activation License Key</p>
                    <div style="font-size: 20px; font-weight: 700; font-family: monospace; color: #b45309; background-color: #ffffff; padding: 12px 16px; border-radius: 6px; display: inline-block; border: 1px solid #fcd34d;">
                        ${licenseKey}
                    </div>
                    <p style="color: #78350f; font-size: 13px; font-weight: 500; margin: 12px 0 0 0;">🌍 Assigned Timezone: <strong>${gmtLocation}</strong></p>
                </div>
                <p style="color: #64748b; font-size: 14px; line-height: 1.5; margin-bottom: 24px;">
                    To activate your organization, visit the CeguyyyDrive registration page, select <strong>"Register as Organization Owner"</strong>, and enter your email address (<strong>${email}</strong>) along with the License Key above.
                </p>
                <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center;">
                    <p style="color: #94a3b8; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} CeguyyyDrive. All rights reserved.</p>
                </div>
            </div>
        `;

        const rawKey = process.env.PLUNK_API_KEY || this.apiKey;
        const apiKey = rawKey ? (rawKey.startsWith('Bearer ') ? rawKey.slice(7).trim() : rawKey.trim()) : null;

        if (!apiKey) {
            console.log('\n======================================================');
            console.log(`[PLUNK LICENSE EMAIL DEV FALLBACK] To: ${email} | Key: ${licenseKey} | Plan: ${planName}`);
            console.log('======================================================\n');
            return true;
        }

        try {
            await axios.post(this.apiUrl, {
                to: email,
                from: fromEmail,
                subject: subject,
                body: htmlBody
            }, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });
            console.log(`[Plunk Email Sent] License key delivered to ${email} from ${fromEmail}`);
            return true;
        } catch (err) {
            console.error('\n❌ [Plunk API Error Details]:', JSON.stringify(err.response?.data || err.message, null, 2));
            console.log(`\n👉 [DONT WORRY! PLUNK LICENSE FALLBACK LOG] To: ${email} | Key: ${licenseKey}\n`);
            return true;
        }
    }

    async sendOrgInviteEmail(email, { orgName, orgId, roleName, inviterName }) {
        const subject = `📨 You've been invited to join ${orgName} on CeguyyyDrive`;
        const fromEmail = process.env.PLUNK_FROM_EMAIL || 'noreply@christiangunawan.my.id';

        // CORS_ORIGIN may hold a comma-separated list; the first entry is the app.
        const appUrl = (process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:5173')
            .split(',')[0]
            .trim()
            .replace(/\/$/, '');
        const joinUrl = `${appUrl}/register?orgId=${encodeURIComponent(orgId)}`;
        const invitedBy = inviterName ? `<strong>${inviterName}</strong> has` : 'You have been';

        const htmlBody = `
            <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
                <div style="text-align: center; margin-bottom: 24px;">
                    <h1 style="color: #1e293b; font-size: 24px; font-weight: 700; margin: 0;">CeguyyyDrive</h1>
                    <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Secure Enterprise Cloud Storage</p>
                </div>
                <p style="color: #334155; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
                    ${invitedBy} invited you to join <strong>${orgName}</strong> as <strong>${roleName}</strong>.
                </p>
                <div style="text-align: center; margin-bottom: 24px;">
                    <a href="${joinUrl}" style="display: inline-block; background-color: #3b82f6; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 28px; border-radius: 8px;">
                        Accept Invitation
                    </a>
                </div>
                <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 24px; border: 1px dashed #cbd5e1;">
                    <p style="color: #475569; font-size: 13px; margin: 0 0 8px 0;">If the button does not work, register manually and enter this Organization ID:</p>
                    <div style="font-size: 14px; font-weight: 700; font-family: monospace; color: #1e293b; background-color: #ffffff; padding: 10px 12px; border-radius: 6px; border: 1px solid #e2e8f0; word-break: break-all;">
                        ${orgId}
                    </div>
                </div>
                <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin-bottom: 24px;">
                    Use this email address (<strong>${email}</strong>) when registering so your invitation is matched automatically.
                </p>
                <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center;">
                    <p style="color: #94a3b8; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} CeguyyyDrive. All rights reserved.</p>
                </div>
            </div>
        `;

        const rawKey = process.env.PLUNK_API_KEY || this.apiKey;
        const apiKey = rawKey ? (rawKey.startsWith('Bearer ') ? rawKey.slice(7).trim() : rawKey.trim()) : null;

        if (!apiKey) {
            console.log('\n======================================================');
            console.log(`[PLUNK INVITE EMAIL DEV FALLBACK] To: ${email} | Org: ${orgName} | Role: ${roleName}`);
            console.log(`[PLUNK INVITE EMAIL DEV FALLBACK] Join URL: ${joinUrl}`);
            console.log('======================================================\n');
            return true;
        }

        try {
            await axios.post(this.apiUrl, {
                to: email,
                from: fromEmail,
                subject: subject,
                body: htmlBody
            }, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });
            console.log(`[Plunk Email Sent] Invitation to ${orgName} delivered to ${email} from ${fromEmail}`);
            return true;
        } catch (err) {
            console.error('\n❌ [Plunk API Error Details]:', JSON.stringify(err.response?.data || err.message, null, 2));
            console.log(`\n👉 [DONT WORRY! PLUNK INVITE FALLBACK LOG] To: ${email} | Join URL: ${joinUrl}\n`);
            return true;
        }
    }
}

module.exports = new PlunkService();
