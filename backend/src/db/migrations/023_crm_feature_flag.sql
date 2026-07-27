-- CRM is a separate application, served from its own subdomain. This flag only
-- controls whether an organization sees the entry point to it; the CRM itself
-- will enforce access independently once it exists.
--
-- Defaults to false so no existing organization gains a link to a product it has
-- not been sold.
ALTER TABLE organizations      ADD COLUMN IF NOT EXISTS feature_crm_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE org_licenses       ADD COLUMN IF NOT EXISTS feature_crm_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE subscription_tiers ADD COLUMN IF NOT EXISTS feature_crm_enabled BOOLEAN NOT NULL DEFAULT false;
