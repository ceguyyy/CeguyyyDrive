-- Three additions, all CRM- or hierarchy-related.

-- 1. A seat limit for CRM, alongside the board and record quotas from 024.
--    Zero means none, for the same reason: entitlement is granted deliberately.
ALTER TABLE organizations      ADD COLUMN IF NOT EXISTS crm_max_users INT NOT NULL DEFAULT 0;
ALTER TABLE org_licenses       ADD COLUMN IF NOT EXISTS crm_max_users INT NOT NULL DEFAULT 0;
ALTER TABLE subscription_tiers ADD COLUMN IF NOT EXISTS crm_max_users INT NOT NULL DEFAULT 0;

-- 2. CRM can be switched off for a whole role in the hierarchy.
--    Defaults to true: the organization-level flag already decides whether CRM
--    exists at all, so a role should not additionally have to be opted in.
ALTER TABLE organization_roles ADD COLUMN IF NOT EXISTS crm_enabled BOOLEAN NOT NULL DEFAULT true;

-- 3. Suspension of a member, distinct from users.status.
--
--    users.status (migration 019) is platform-wide and set by a Super Admin.
--    These are scoped to one organization and set by someone above the member in
--    its role hierarchy, so the same person can be suspended in one organization
--    and active in another.
--
--    Two levels, because they answer different questions: suspended_at removes
--    the member from the organization entirely, crm_suspended_at removes only
--    their CRM access while they keep working in the drive.
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS suspended_at      TIMESTAMP WITH TIME ZONE;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS crm_suspended_at  TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_org_members_suspended
    ON organization_members(organization_id) WHERE suspended_at IS NOT NULL;
