-- Migration 012: Add per-plan organization creation limit
-- The cap belongs to the org owner, but is granted by the plan tier of the
-- organizations they already own. A user owning no organization has no plan,
-- and therefore no entitlement -- their first org must come from a license key.

ALTER TABLE org_licenses ADD COLUMN IF NOT EXISTS max_organizations INT DEFAULT 1;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS max_organizations INT DEFAULT 1;

-- Backfill existing rows from their current plan tier.
-- Custom is treated as Pro-equivalent; Super Admin can override it per org.
UPDATE org_licenses SET max_organizations = CASE plan_name
    WHEN 'Enterprise' THEN 25
    WHEN 'Pro' THEN 3
    WHEN 'Custom' THEN 3
    ELSE 1
END;

UPDATE organizations SET max_organizations = CASE plan_name
    WHEN 'Enterprise' THEN 25
    WHEN 'Pro' THEN 3
    WHEN 'Custom' THEN 3
    ELSE 1
END;
