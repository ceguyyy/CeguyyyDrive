/**
 * Tencent Captcha, in one place.
 *
 * The app id previously appeared twice with different hardcoded fallbacks. A
 * ticket is only verifiable against the app that issued it, so a page falling
 * back to a different id produced tickets the server could never validate —
 * invisible on Login, which does not verify server-side, and fatal on password
 * reset, which does.
 *
 * There is no fallback id here on purpose: an unset VITE_CAPTCHA_APP_ID is a
 * misconfiguration, and it should say so rather than issue useless tickets.
 */
const APP_ID = String(import.meta.env.VITE_CAPTCHA_APP_ID || '').trim();

export const captchaAppId = APP_ID;

export const isCaptchaAvailable = () =>
    APP_ID.length > 0 && typeof window !== 'undefined' && !!window.TencentCaptcha;

/**
 * Shows the challenge and resolves with the ticket to send to the server.
 *
 * Rejects — rather than resolving empty — when the challenge cannot run or the
 * user dismisses it. A caller that needs a verified ticket must not be handed a
 * request it can only fail with.
 *
 * @param {string} containerId id of an element to mount into
 * @returns {Promise<{ticket: string, randstr: string}>}
 */
export function runCaptcha(containerId) {
    return new Promise((resolve, reject) => {
        if (!APP_ID) {
            reject(new Error('Captcha is not configured. VITE_CAPTCHA_APP_ID is unset in this build.'));
            return;
        }
        if (typeof window === 'undefined' || !window.TencentCaptcha) {
            reject(new Error('The captcha script did not load. Check the connection or an ad blocker, then try again.'));
            return;
        }

        const container = document.getElementById(containerId);
        // Clear any widget left by a previous attempt; Tencent's script appends
        // rather than replaces, and a stale instance swallows the callback.
        if (container) container.innerHTML = '';

        try {
            const captcha = new window.TencentCaptcha(container, APP_ID, (res) => {
                if (res.ret === 0) {
                    resolve({ ticket: res.ticket, randstr: res.randstr });
                } else {
                    reject(new Error('Captcha was cancelled.'));
                }
            }, {});
            captcha.show();
        } catch (err) {
            reject(new Error(`Captcha could not start: ${err.message}`));
        }
    });
}
