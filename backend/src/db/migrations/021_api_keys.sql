-- API keys for integrating an organization's Company Drive with outside systems.
--
-- Scope is deliberately narrow: listing, downloading, uploading, and creating
-- folders inside one organization. Billing, members, roles, approvals, and other
-- organizations are unreachable with a key, so a leaked key cannot escalate into
-- an account takeover the way a stolen session could.
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    -- Requests act as this user, so the key sees exactly what its creator sees
    -- in the role hierarchy. Deleting them disables the key.
    created_by UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,

    -- Shown in the UI so a key can be told apart without ever revealing it.
    key_prefix VARCHAR(24) NOT NULL,
    -- SHA-256 of the full key. The plaintext is returned once at creation and
    -- never stored, so a database leak yields no usable credentials.
    -- SHA-256 rather than bcrypt on purpose: the key is 256 bits of CSPRNG
    -- output, not a guessable password, and this runs on every API request.
    key_hash CHAR(64) NOT NULL UNIQUE,

    scopes TEXT[] NOT NULL DEFAULT ARRAY['files:read', 'files:write'],
    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_org ON api_keys(organization_id);

-- Integration is a billable feature, switched per organization by Super Admin
-- and preset per subscription tier, alongside approval and chat.
--
-- Enforced in the integration middleware, not merely by hiding the sidebar
-- item: turning the feature off must disable keys that were already issued.
--
-- Defaults to false so no existing organization silently gains an API surface.
ALTER TABLE organizations      ADD COLUMN IF NOT EXISTS feature_integration_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE org_licenses       ADD COLUMN IF NOT EXISTS feature_integration_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE subscription_tiers ADD COLUMN IF NOT EXISTS feature_integration_enabled BOOLEAN NOT NULL DEFAULT false;

-- Seeded tiers: the paid ones get it, Starter does not.
UPDATE subscription_tiers SET feature_integration_enabled = true WHERE name IN ('Pro', 'Enterprise');
