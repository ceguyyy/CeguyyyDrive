-- Subscription tiers become editable data instead of four copies of the same
-- table hardcoded across the codebase (config/planLimits.js, billingService's
-- getPlanDefaults, billingService's createLicenseKey, and the admin UI).
--
-- A tier is a PRESET, not a live foreign key: organizations and org_licenses
-- keep their own storage_limit_bytes / max_members / feature flags, copied at
-- creation time. Editing or deleting a tier therefore does not disturb anyone
-- already provisioned — applying a change to existing organizations is an
-- explicit, separate action in the admin UI.

CREATE TABLE IF NOT EXISTS subscription_tiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- Matches organizations.plan_name / org_licenses.plan_name by value.
    name VARCHAR(50) UNIQUE NOT NULL,
    label VARCHAR(100),
    storage_limit_bytes BIGINT NOT NULL,
    member_storage_limit_bytes BIGINT NOT NULL,
    max_members INT NOT NULL,
    max_organizations INT NOT NULL DEFAULT 1,
    feature_approval_enabled BOOLEAN NOT NULL DEFAULT true,
    feature_chat_enabled BOOLEAN NOT NULL DEFAULT true,
    sort_order INT NOT NULL DEFAULT 100,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subscription_tiers_sort ON subscription_tiers(sort_order, name);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_subscription_tiers_updated_at'
    ) THEN
        CREATE TRIGGER update_subscription_tiers_updated_at
        BEFORE UPDATE ON subscription_tiers
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Seed the three presets the provisioning dropdown already offered, with the
-- values the backend applies today, so behaviour is unchanged on first deploy.
-- Taken from billingService.getPlanDefaults and
-- config/planLimits.PLAN_MAX_ORGANIZATIONS — the two the server actually reads.
--
-- 'Custom' is deliberately absent: it is the UI's "type the quotas by hand"
-- mode, not a preset, and subscriptionTierService reserves the name.
-- 'Free' is also absent: it is the organizations.plan_name column default for
-- workspaces created without a licence, never an option an admin picks. Those
-- rows carry their own quotas from migration 009, and billingService falls back
-- to its hardcoded Free defaults when no tier matches.
--
-- ON CONFLICT DO NOTHING so re-running never clobbers an admin's edits.
INSERT INTO subscription_tiers (
    name, label, storage_limit_bytes, member_storage_limit_bytes,
    max_members, max_organizations, feature_approval_enabled, feature_chat_enabled, sort_order
) VALUES
    ('Starter',    'Starter',         5368709120,    5368709120,     5,   1, false, false, 10),
    ('Pro',        'Pro Business',  107374182400,   21474836480,    25,   3, true,  true,  20),
    ('Enterprise', 'Enterprise',   1099511627776,  107374182400,   500,  25, true,  true,  30)
ON CONFLICT (name) DO NOTHING;
