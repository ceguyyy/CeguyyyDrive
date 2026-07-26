const crypto = require('crypto');
const apiKeyRepository = require('../repositories/apiKeyRepository');
const organizationRepository = require('../repositories/organizationRepository');
const AppError = require('../utils/AppError');
const { isSuperAdminRole } = require('../config/platformRoles');

const KEY_PREFIX = 'cgd';
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
    // The organization owner, or a platform Super Admin operating on their
    // behalf. A key grants drive access to whoever holds it, so issuing one is
    // never delegated down the role hierarchy — a Manager cannot mint one.
    async assertCanManageKeys(orgId, userId, actorRoleName) {
        const org = await organizationRepository.findOrganizationById(orgId);
        if (!org) throw new AppError('Organization not found', 404);

        if (org.owner_id !== userId && !isSuperAdminRole(actorRoleName)) {
            throw new AppError('Only the organization owner can manage API keys.', 403);
        }
        return org;
    }

    async listKeys(orgId, userId, actorRoleName) {
        await this.assertCanManageKeys(orgId, userId, actorRoleName);
        return await apiKeyRepository.findByOrganization(orgId);
    }

    async createKey(orgId, userId, { name, scopes, expiresInDays } = {}, actorRoleName = null) {
        await this.assertCanManageKeys(orgId, userId, actorRoleName);

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

        let expiresAt = null;
        if (expiresInDays !== undefined && expiresInDays !== null && expiresInDays !== '') {
            const days = Number(expiresInDays);
            if (!Number.isInteger(days) || days <= 0) {
                throw new AppError('Expiry must be a whole number of days greater than zero.', 400);
            }
            expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        }

        // randomBytes, not Math.random: this value is the credential.
        const secret = crypto.randomBytes(SECRET_BYTES).toString('base64url');
        const publicId = crypto.randomBytes(6).toString('hex');
        const fullKey = `${KEY_PREFIX}_${publicId}_${secret}`;

        const record = await apiKeyRepository.create({
            organizationId: orgId,
            createdBy: userId,
            name: label,
            keyPrefix: `${KEY_PREFIX}_${publicId}`,
            keyHash: sha256(fullKey),
            scopes: requested,
            expiresAt
        });

        // The only time the plaintext exists outside the caller's request.
        return { key: record, plaintext: fullKey };
    }

    async revokeKey(orgId, userId, keyId, actorRoleName = null) {
        await this.assertCanManageKeys(orgId, userId, actorRoleName);
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
            organizationId: record.organization_id,
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
