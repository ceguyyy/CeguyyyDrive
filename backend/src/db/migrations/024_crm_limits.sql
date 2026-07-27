-- How much CRM an organization is entitled to, alongside the on/off flag from
-- migration 023.
--
--   crm_max_boards  — how many tables/boards may exist
--   crm_max_records — how many rows may exist across them
--
-- Zero means none, which is the right default: an organization that has not been
-- sold CRM should not silently acquire an allowance when the feature is later
-- switched on. Enabling CRM and granting a quota are two deliberate acts.
ALTER TABLE organizations      ADD COLUMN IF NOT EXISTS crm_max_boards  INT NOT NULL DEFAULT 0;
ALTER TABLE organizations      ADD COLUMN IF NOT EXISTS crm_max_records INT NOT NULL DEFAULT 0;

ALTER TABLE org_licenses       ADD COLUMN IF NOT EXISTS crm_max_boards  INT NOT NULL DEFAULT 0;
ALTER TABLE org_licenses       ADD COLUMN IF NOT EXISTS crm_max_records INT NOT NULL DEFAULT 0;

ALTER TABLE subscription_tiers ADD COLUMN IF NOT EXISTS crm_max_boards  INT NOT NULL DEFAULT 0;
ALTER TABLE subscription_tiers ADD COLUMN IF NOT EXISTS crm_max_records INT NOT NULL DEFAULT 0;
