const subscriptionTierRepository = require('../repositories/subscriptionTierRepository');
const AppError = require('../utils/AppError');
const { maxOrganizationsForPlan } = require('../config/planLimits');

const BYTES_PER_GB = 1024 ** 3;

// 'Custom' is the admin UI's sentinel for "type the quotas by hand", not a
// stored preset. A tier by that name would make the dropdown ambiguous.
const RESERVED_TIER_NAMES = ['custom'];

const gbToBytes = (gb) => Math.round(Number(gb) * BYTES_PER_GB);

function requirePositiveInt(value, field) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
        throw new AppError(`${field} must be a whole number greater than zero.`, 400);
    }
    return parsed;
}

function requirePositiveGb(value, field) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new AppError(`${field} must be greater than zero.`, 400);
    }
    return gbToBytes(parsed);
}

// The admin UI speaks snake_case and GB; the repository speaks camelCase and
// bytes. Partial payloads are allowed on update, so absent fields stay
// undefined and the repository's COALESCE keeps the stored value.
function toTierFields(body = {}, { partial = false } = {}) {
    const fields = {};

    if (body.name !== undefined || !partial) {
        const name = String(body.name || '').trim();
        if (!name) throw new AppError('Tier name is required.', 400);
        if (RESERVED_TIER_NAMES.includes(name.toLowerCase())) {
            throw new AppError(`"${name}" is reserved and cannot be used as a tier name.`, 400);
        }
        fields.name = name;
    }

    if (body.label !== undefined || !partial) {
        fields.label = String(body.label || fields.name || '').trim() || null;
    }

    if (body.storage_limit_gb !== undefined || !partial) {
        fields.storageLimitBytes = requirePositiveGb(body.storage_limit_gb, 'Total storage');
    }
    if (body.member_storage_limit_gb !== undefined || !partial) {
        fields.memberStorageLimitBytes = requirePositiveGb(body.member_storage_limit_gb, 'Per-member storage');
    }
    if (body.max_members !== undefined || !partial) {
        fields.maxMembers = requirePositiveInt(body.max_members, 'Max members');
    }
    if (body.max_organizations !== undefined || !partial) {
        fields.maxOrganizations = requirePositiveInt(body.max_organizations, 'Max organizations');
    }

    if (body.feature_approval_enabled !== undefined) {
        fields.featureApprovalEnabled = Boolean(body.feature_approval_enabled);
    } else if (!partial) {
        fields.featureApprovalEnabled = true;
    }

    if (body.feature_chat_enabled !== undefined) {
        fields.featureChatEnabled = Boolean(body.feature_chat_enabled);
    } else if (!partial) {
        fields.featureChatEnabled = true;
    }

    // Defaults to false, not true: Integration exposes an API surface, so it is
    // opted into rather than granted by omission.
    if (body.feature_integration_enabled !== undefined) {
        fields.featureIntegrationEnabled = Boolean(body.feature_integration_enabled);
    } else if (!partial) {
        fields.featureIntegrationEnabled = false;
    }

    // Also off by default: CRM is a separate product, sold separately.
    if (body.feature_crm_enabled !== undefined) {
        fields.featureCrmEnabled = Boolean(body.feature_crm_enabled);
    } else if (!partial) {
        fields.featureCrmEnabled = false;
    }

    if (body.sort_order !== undefined) {
        fields.sortOrder = Number(body.sort_order);
    } else if (!partial) {
        fields.sortOrder = 100;
    }

    return fields;
}

class SubscriptionTierService {
    async getAllTiers() {
        return await subscriptionTierRepository.findAll();
    }

    /**
     * The preset a plan name resolves to, for provisioning.
     *
     * Falls back to null when the tier is absent — 'Custom', a deleted tier, or
     * a database that has not run migration 018 — so callers keep their existing
     * hardcoded defaults rather than provisioning zeroes.
     */
    async getDefaultsFor(planName) {
        if (!planName) return null;
        const tier = await subscriptionTierRepository.findByName(planName);
        if (!tier) return null;
        return {
            storageLimitBytes: Number(tier.storage_limit_bytes),
            memberStorageLimitBytes: Number(tier.member_storage_limit_bytes),
            maxMembers: tier.max_members,
            maxOrganizations: tier.max_organizations,
            featureApprovalEnabled: tier.feature_approval_enabled,
            featureChatEnabled: tier.feature_chat_enabled,
            featureIntegrationEnabled: tier.feature_integration_enabled,
            featureCrmEnabled: tier.feature_crm_enabled
        };
    }

    // Used where a plan name is all we have. Prefers the editable tier, then the
    // frozen map in config/planLimits.
    async resolveMaxOrganizations(planName) {
        const defaults = await this.getDefaultsFor(planName);
        return defaults ? defaults.maxOrganizations : maxOrganizationsForPlan(planName);
    }

    async createTier(body) {
        const fields = toTierFields(body, { partial: false });
        this.#assertMemberCapWithinTotal(fields);

        const clash = await subscriptionTierRepository.findByName(fields.name);
        if (clash) {
            throw new AppError(`A tier named "${fields.name}" already exists.`, 409);
        }

        return await subscriptionTierRepository.create(fields);
    }

    async updateTier(id, body) {
        const existing = await subscriptionTierRepository.findById(id);
        if (!existing) throw new AppError('Subscription tier not found', 404);

        const fields = toTierFields(body, { partial: true });

        // Validate the merged result: a payload that only raises the per-member
        // cap must still be checked against the stored total.
        this.#assertMemberCapWithinTotal({
            storageLimitBytes: fields.storageLimitBytes ?? Number(existing.storage_limit_bytes),
            memberStorageLimitBytes: fields.memberStorageLimitBytes ?? Number(existing.member_storage_limit_bytes)
        });

        const isRename = fields.name && fields.name.toLowerCase() !== existing.name.toLowerCase();
        if (isRename) {
            const clash = await subscriptionTierRepository.findByName(fields.name);
            if (clash) {
                throw new AppError(`A tier named "${fields.name}" already exists.`, 409);
            }
        }

        const updated = await subscriptionTierRepository.update(id, fields);

        // plan_name is matched by value, so a rename must carry every existing
        // reference with it or those rows silently stop resolving to any tier.
        if (isRename) {
            await subscriptionTierRepository.renamePlanReferences(existing.name, updated.name);
        }

        let applied = null;
        if (body.apply_to_existing) {
            applied = await subscriptionTierRepository.applyToExisting(updated.name, updated);
        }

        return { tier: updated, applied };
    }

    async deleteTier(id) {
        // Deleting removes a preset, nothing more: organizations keep the quotas
        // already copied onto them and carry on with their plan_name as written.
        const deleted = await subscriptionTierRepository.delete(id);
        if (!deleted) throw new AppError('Subscription tier not found', 404);
        return deleted;
    }

    #assertMemberCapWithinTotal({ storageLimitBytes, memberStorageLimitBytes }) {
        if (!storageLimitBytes || !memberStorageLimitBytes) return;
        if (memberStorageLimitBytes > storageLimitBytes) {
            const memberGB = (memberStorageLimitBytes / BYTES_PER_GB).toFixed(2);
            const totalGB = (storageLimitBytes / BYTES_PER_GB).toFixed(2);
            throw new AppError(
                `Per-member storage (${memberGB} GB) cannot exceed the tier's total storage (${totalGB} GB).`,
                400
            );
        }
    }
}

module.exports = new SubscriptionTierService();
