const crypto = require('crypto');
const apiKeyRepository = require('../repositories/apiKeyRepository');
const organizationRepository = require('../repositories/organizationRepository');
const AppError = require('../utils/AppError');

// New keys are minted with this prefix. Keys issued before the rename still
// carry 'cgd' and keep working: resolve() hashes whatever string is presented
// and matches it whole, so the prefix is a label rather than a lookup key.
// LEGACY_KEY_PREFIXES exists only for the Authorization-header shortcut, which
// has to recognise a key by sight before hashing it.
const KEY_PREFIX = 'abx';
const LEGACY_KEY_PREFIXES = ['cgd'];
const RECOGNISED_KEY_PREFIXES = [KEY_PREFIX, ...LEGACY_KEY_PREFIXES];
const SECRET_BYTES = 32;
const MAX_KEYS_PER_ORG = 20;

// Granular on purpose. A single blanket scope would mean an integration that
// only needs to list files could also invite members into the organization or
// approve documents on someone's behalf.
const SCOPE_READ = 'files:read';
const SCOPE_WRITE = 'files:write';
const SCOPE_ORG_READ = 'org:read';
const SCOPE_MEMBERS_WRITE = 'members:write';
const SCOPE_APPROVALS_READ = 'approvals:read';
const SCOPE_APPROVALS_WRITE = 'approvals:write';

const VALID_SCOPES = [
    SCOPE_READ,
    SCOPE_WRITE,
    SCOPE_ORG_READ,
    SCOPE_MEMBERS_WRITE,
    SCOPE_APPROVALS_READ,
    SCOPE_APPROVALS_WRITE
];

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

class ApiKeyService {
    // The organization owner, and nobody else.
    //
    // Not delegated down the role hierarchy — a Manager cannot mint a key — and
    // deliberately not extended to Super Admins either. A key grants standing
    // access to an organization's files, so being able to operate the platform
    // is not the same as being entitled to read a customer's drive. A Super
    // Admin who needs one issues it for an organization they actually own.
    async assertCanManageKeys(orgId, userId) {
        const org = await organizationRepository.findOrganizationById(orgId);
        if (!org) throw new AppError('Organization not found', 404);

        if (org.owner_id !== userId) {
            throw new AppError('Only the organization owner can manage API keys.', 403);
        }
        return org;
    }

    async listKeys(orgId, userId) {
        await this.assertCanManageKeys(orgId, userId);
        return await apiKeyRepository.findByOrganization(orgId);
    }

    async createKey(orgId, userId, { name, scopes, expiresInDays } = {}) {
        await this.assertCanManageKeys(orgId, userId);

        const label = String(name || '').trim();
        if (!label) throw new AppError('Give the key a name so you can recognise it later.', 400);

        const requested = Array.isArray(scopes) && scopes.length > 0 ? scopes : [SCOPE_READ, SCOPE_WRITE];
        const invalid = requested.filter(s => !VALID_SCOPES.includes(s));
        if (invalid.length > 0) {
            throw new AppError(`Unknown scope: ${invalid.join(', ')}. Allowed: ${VALID_SCOPES.join(', ')}.`, 400);
        }

        const existing = await apiKeyRepository.findByOrganization(orgId);
        const active = existing.filter(k => !k.revoked_at);
        if (active.length >= MAX_KEYS_PER_ORG) {
            throw new AppError(`This organization already has ${MAX_KEYS_PER_ORG} active keys. Revoke one first.`, 400);
        }

        const expiresAt = this.#parseExpiry(expiresInDays);
        const { fullKey, keyPrefix } = this.#mintKey();

        const record = await apiKeyRepository.create({
            organizationId: orgId,
            createdBy: userId,
            name: label,
            keyPrefix,
            keyHash: sha256(fullKey),
            scopes: requested,
            expiresAt
        });

        // The only time the plaintext exists outside the caller's request.
        return { key: record, plaintext: fullKey };
    }

    /* ── Personal Drive keys ───────────────────────────────────────────── */

    // No organization, so no owner check and no billing feature gate: the key
    // reaches only the drive of the user who created it. Personal keys are
    // always files-only — there is no organization to read or invite into.
    async listPersonalKeys(userId) {
        return await apiKeyRepository.findPersonal(userId);
    }

    async createPersonalKey(userId, { name, scopes, expiresInDays } = {}) {
        const label = String(name || '').trim();
        if (!label) throw new AppError('Give the key a name so you can recognise it later.', 400);

        const requested = Array.isArray(scopes) && scopes.length > 0 ? scopes : [SCOPE_READ, SCOPE_WRITE];
        const allowed = [SCOPE_READ, SCOPE_WRITE];
        const invalid = requested.filter(s => !allowed.includes(s));
        if (invalid.length > 0) {
            throw new AppError(
                `Personal Drive keys support only ${allowed.join(' and ')}. Rejected: ${invalid.join(', ')}.`,
                400
            );
        }

        const active = (await apiKeyRepository.findPersonal(userId)).filter(k => !k.revoked_at);
        if (active.length >= MAX_KEYS_PER_ORG) {
            throw new AppError(`You already have ${MAX_KEYS_PER_ORG} active personal keys. Revoke one first.`, 400);
        }

        const expiresAt = this.#parseExpiry(expiresInDays);
        const { fullKey, keyPrefix } = this.#mintKey();

        const record = await apiKeyRepository.create({
            organizationId: null,
            createdBy: userId,
            name: label,
            keyPrefix,
            keyHash: sha256(fullKey),
            scopes: requested,
            expiresAt
        });

        return { key: record, plaintext: fullKey };
    }

    async revokePersonalKey(userId, keyId) {
        const revoked = await apiKeyRepository.revokePersonal(userId, keyId);
        if (!revoked) throw new AppError('API key not found, or already revoked.', 404);
        return revoked;
    }

    #parseExpiry(expiresInDays) {
        if (expiresInDays === undefined || expiresInDays === null || expiresInDays === '') return null;
        const days = Number(expiresInDays);
        if (!Number.isInteger(days) || days <= 0) {
            throw new AppError('Expiry must be a whole number of days greater than zero.', 400);
        }
        return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    }

    #mintKey() {
        // randomBytes, not Math.random: this value is the credential.
        const secret = crypto.randomBytes(SECRET_BYTES).toString('base64url');
        const publicId = crypto.randomBytes(6).toString('hex');
        return { fullKey: `${KEY_PREFIX}_${publicId}_${secret}`, keyPrefix: `${KEY_PREFIX}_${publicId}` };
    }

    async revokeKey(orgId, userId, keyId) {
        await this.assertCanManageKeys(orgId, userId);
        const revoked = await apiKeyRepository.revoke(orgId, keyId);
        if (!revoked) throw new AppError('API key not found, or already revoked.', 404);
        return revoked;
    }

    /**
     * Resolves a presented key to the context a request may act in.
     * Returns null for anything unusable, so callers cannot accidentally treat
     * a revoked or expired key as valid.
     */
    async resolve(presentedKey) {
        if (!presentedKey || typeof presentedKey !== 'string') return null;

        const record = await apiKeyRepository.findActiveByHash(sha256(presentedKey.trim()));
        if (!record) return null;

        // A suspended creator must not keep an integration alive.
        if (record.creator_status === 'suspended') return null;

        return {
            keyId: record.id,
            // null means a Personal Drive key: it acts on the user's own drive
            // rather than an organization's.
            organizationId: record.organization_id,
            isPersonal: record.organization_id === null,
            userId: record.created_by,
            scopes: record.scopes || []
        };
    }
}

module.exports = new ApiKeyService();
module.exports.SCOPE_READ = SCOPE_READ;
module.exports.SCOPE_WRITE = SCOPE_WRITE;
module.exports.SCOPE_ORG_READ = SCOPE_ORG_READ;
module.exports.SCOPE_MEMBERS_WRITE = SCOPE_MEMBERS_WRITE;
module.exports.SCOPE_APPROVALS_READ = SCOPE_APPROVALS_READ;
module.exports.SCOPE_APPROVALS_WRITE = SCOPE_APPROVALS_WRITE;
module.exports.VALID_SCOPES = VALID_SCOPES;
module.exports.RECOGNISED_KEY_PREFIXES = RECOGNISED_KEY_PREFIXES;
