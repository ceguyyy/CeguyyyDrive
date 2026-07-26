const crypto = require('crypto');
const billingRepository = require('../repositories/billingRepository');
const plunkService = require('./plunkService');
const cosService = require('./cosService');
const AppError = require('../utils/AppError');
const subscriptionTierService = require('./subscriptionTierService');

const BYTES_PER_GB = 1024 ** 3;

// Crockford base32: no I, L, O or U, so keys cannot be misread when typed
// by hand and cannot accidentally spell words.
const KEY_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const KEY_RANDOM_LENGTH = 24;
const MAX_KEY_ATTEMPTS = 5;

// crypto.randomBytes, not Math.random: license keys grant paid entitlements,
// so they must not be predictable from previously issued keys.
// 256 is an exact multiple of 32, so the modulo introduces no bias.
function randomKeySegment(length = KEY_RANDOM_LENGTH) {
    const bytes = crypto.randomBytes(length);
    let segment = '';
    for (let i = 0; i < length; i += 1) {
        segment += KEY_ALPHABET[bytes[i] % KEY_ALPHABET.length];
    }
    return segment;
}

async function generateUniqueLicenseKey(planName) {
    const year = new Date().getFullYear();
    for (let attempt = 0; attempt < MAX_KEY_ATTEMPTS; attempt += 1) {
        const candidate = `CEGUYY-${planName.toUpperCase()}-${year}-${randomKeySegment()}`;
        const existing = await billingRepository.findLicenseByKey(candidate);
        if (!existing) return candidate;
    }
    throw new AppError('Could not generate a unique license key. Please try again.', 500);
}

// Fallback only. The editable subscription_tiers table is the source of truth;
// these values survive so an un-migrated database, a deleted tier, or 'Custom'
// still provisions something sane instead of zeroes.
function hardcodedPlanDefaults(planName = '') {
    const p = planName.toLowerCase();
    if (p === 'starter' || p === 'free') {
        return {
            storageLimitBytes: 5368709120, // 5 GB
            memberStorageLimitBytes: 5368709120, // 5 GB
            maxMembers: 5,
            featureApprovalEnabled: false,
            featureChatEnabled: false,
            featureIntegrationEnabled: false
        };
    } else if (p === 'pro') {
        return {
            storageLimitBytes: 107374182400, // 100 GB
            memberStorageLimitBytes: 21474836480, // 20 GB
            maxMembers: 25,
            featureApprovalEnabled: true,
            featureChatEnabled: true,
            featureIntegrationEnabled: true
        };
    } else if (p === 'enterprise') {
        return {
            storageLimitBytes: 1099511627776, // 1 TB
            memberStorageLimitBytes: 107374182400, // 100 GB
            maxMembers: 500,
            featureApprovalEnabled: true,
            featureChatEnabled: true,
            featureIntegrationEnabled: true
        };
    }
    return {
        storageLimitBytes: 53687091200, // 50 GB
        memberStorageLimitBytes: 10737418240, // 10 GB
        maxMembers: 20,
        featureApprovalEnabled: true,
        featureChatEnabled: true,
        featureIntegrationEnabled: false
    };
}

// What a plan name provisions: the editable tier if one exists, else the
// frozen defaults above.
async function resolvePlanDefaults(planName = '') {
    const tier = await subscriptionTierService.getDefaultsFor(planName);
    return tier || hardcodedPlanDefaults(planName);
}

// The Super Admin UI sends snake_case fields and expresses storage in GB.
// The repository works in camelCase and bytes.
async function toBillingUpdate(body = {}) {
    const gbToBytes = (gb) =>
        gb === undefined || gb === null || gb === '' ? undefined : Math.round(Number(gb) * BYTES_PER_GB);
    const toInt = (v) => (v === undefined || v === null || v === '' ? undefined : Number(v));

    const defaults = body.plan_name ? await resolvePlanDefaults(body.plan_name) : {};

    return {
        planName: body.plan_name,
        storageLimitBytes: gbToBytes(body.storage_limit_gb) !== undefined ? gbToBytes(body.storage_limit_gb) : defaults.storageLimitBytes,
        maxMembers: toInt(body.max_members) !== undefined ? toInt(body.max_members) : defaults.maxMembers,
        memberStorageLimitBytes: gbToBytes(body.member_storage_limit_gb) !== undefined ? gbToBytes(body.member_storage_limit_gb) : defaults.memberStorageLimitBytes,
        featureApprovalEnabled: body.feature_approval_enabled !== undefined ? body.feature_approval_enabled : defaults.featureApprovalEnabled,
        featureChatEnabled: body.feature_chat_enabled !== undefined ? body.feature_chat_enabled : defaults.featureChatEnabled,
        featureIntegrationEnabled: body.feature_integration_enabled !== undefined ? body.feature_integration_enabled : defaults.featureIntegrationEnabled,
        maxOrganizations: toInt(body.max_organizations),
        gmtLocation: body.gmt_location || body.gmtLocation,
        customAppTitle: body.custom_app_title !== undefined ? body.custom_app_title : (body.customAppTitle !== undefined ? body.customAppTitle : null),
        customLogoUrl: body.custom_logo_url !== undefined ? body.custom_logo_url : (body.customLogoUrl !== undefined ? body.customLogoUrl : null),
        status: body.status,
        billingNotes: body.admin_notes
    };
}

// A single member may never be allocated more than the whole organization
// holds. Overcommitting across members is allowed and expected -- every plan
// preset does it, since members rarely fill their caps simultaneously.
function assertMemberCapWithinTotal(memberStorageLimitBytes, storageLimitBytes) {
    if (!memberStorageLimitBytes || !storageLimitBytes) return;
    if (memberStorageLimitBytes > storageLimitBytes) {
        const memberGB = (memberStorageLimitBytes / BYTES_PER_GB).toFixed(2);
        const totalGB = (storageLimitBytes / BYTES_PER_GB).toFixed(2);
        throw new AppError(
            `Per-member cap (${memberGB} GB) cannot exceed the organization's total storage (${totalGB} GB).`,
            400
        );
    }
}

class BillingService {
    async createLicenseKey({ ownerEmail, planName = 'Pro', storageLimitBytes, maxMembers, memberStorageLimitBytes, featureApprovalEnabled, featureChatEnabled, featureIntegrationEnabled, maxOrganizations, gmtLocation = 'GMT+7 (Asia/Jakarta)', customAppTitle = null, customLogoUrl = null, sendEmail = true, createdBy = null, customKey = null }) {
        if (!ownerEmail || !ownerEmail.trim()) {
            throw new AppError('Prospective Owner Email address is required', 400);
        }

        let licenseKey;
        if (customKey && customKey.trim()) {
            licenseKey = customKey.trim();
            const taken = await billingRepository.findLicenseByKey(licenseKey);
            if (taken) {
                throw new AppError('That license key already exists. Choose a different one.', 409);
            }
        } else {
            licenseKey = await generateUniqueLicenseKey(planName);
        }

        // Anything the admin left blank falls back to the tier's preset.
        const defaults = await resolvePlanDefaults(planName);
        const finalStorage = storageLimitBytes || defaults.storageLimitBytes;
        const finalMembers = maxMembers || defaults.maxMembers;
        const finalMemberStorage = memberStorageLimitBytes || defaults.memberStorageLimitBytes;
        const finalApproval = featureApprovalEnabled !== undefined
            ? featureApprovalEnabled
            : defaults.featureApprovalEnabled;
        const finalChat = featureChatEnabled !== undefined
            ? featureChatEnabled
            : defaults.featureChatEnabled;
        const finalIntegration = featureIntegrationEnabled !== undefined
            ? featureIntegrationEnabled
            : defaults.featureIntegrationEnabled;

        assertMemberCapWithinTotal(finalMemberStorage, finalStorage);

        const newLicense = await billingRepository.createLicenseKey({
            licenseKey,
            ownerEmail,
            planName,
            storageLimitBytes: finalStorage,
            maxMembers: finalMembers,
            memberStorageLimitBytes: finalMemberStorage,
            featureApprovalEnabled: finalApproval,
            featureChatEnabled: finalChat,
            featureIntegrationEnabled: finalIntegration,
            maxOrganizations: maxOrganizations || await subscriptionTierService.resolveMaxOrganizations(planName),
            gmtLocation: gmtLocation || 'GMT+7 (Asia/Jakarta)',
            customAppTitle: customAppTitle || null,
            customLogoUrl: customLogoUrl || null,
            createdBy
        });

        if (sendEmail) {
            await plunkService.sendLicenseKeyEmail(ownerEmail, licenseKey, planName, gmtLocation || 'GMT+7 (Asia/Jakarta)');
        }

        if (newLicense && newLicense.custom_logo_url) {
            newLicense.custom_logo_url = await cosService.resolvePublicUrl(newLicense.custom_logo_url);
        }

        return newLicense;
    }

    async getAllLicenseKeys() {
        const licenses = await billingRepository.findAllLicenseKeys();
        for (const lic of licenses) {
            if (lic.custom_logo_url) {
                lic.custom_logo_url = await cosService.resolvePublicUrl(lic.custom_logo_url);
            }
        }
        return licenses;
    }

    async deleteLicenseKey(id) {
        const deleted = await billingRepository.deleteLicenseKey(id);
        if (!deleted) {
            throw new AppError('License key not found', 404);
        }
        return deleted;
    }

    async getAllOrganizations() {
        const orgs = await billingRepository.findAllOrganizations();
        for (const org of orgs) {
            if (org.custom_logo_url) {
                org.custom_logo_url = await cosService.resolvePublicUrl(org.custom_logo_url);
            }
        }
        return orgs;
    }

    async updateOrganizationBilling(orgId, requestBody) {
        const update = await toBillingUpdate(requestBody);
        assertMemberCapWithinTotal(update.memberStorageLimitBytes, update.storageLimitBytes);
        const updated = await billingRepository.updateOrganizationBilling(orgId, update);
        if (!updated) {
            throw new AppError('Organization not found', 404);
        }

        // Derived organizations copy their quotas from the licensed one. Without
        // this they would only match at the moment they were created, and the
        // console's claim that they "follow the licensed organization" would be
        // true only until the first edit. A no-op for a derived organization —
        // the query requires the source to hold a licence.
        const propagatedTo = await billingRepository.propagateQuotasToDerived(orgId);

        if (updated.custom_logo_url) {
            updated.custom_logo_url = await cosService.resolvePublicUrl(updated.custom_logo_url);
        }
        return { ...updated, propagated_to: propagatedTo };
    }

    async updateOrganizationStatus(orgId, status) {
        const allowed = ['active', 'suspended', 'trial'];
        if (!allowed.includes(status)) {
            throw new AppError(`Status must be one of: ${allowed.join(', ')}`, 400);
        }
        const updated = await billingRepository.updateOrganizationStatus(orgId, status);
        if (!updated) {
            throw new AppError('Organization not found', 404);
        }
        return updated;
    }

    async deleteOrganizationAdmin(orgId) {
        const deleted = await billingRepository.deleteOrganizationAdmin(orgId);
        if (!deleted) {
            throw new AppError('Organization not found', 404);
        }
        return deleted;
    }

    async getPlatformStats() {
        return await billingRepository.getPlatformStats();
    }
}

module.exports = new BillingService();
