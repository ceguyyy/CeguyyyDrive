-- Migration 010: Add per-member storage limit cap to organizations and org_licenses
ALTER TABLE org_licenses ADD COLUMN IF NOT EXISTS member_storage_limit_bytes BIGINT DEFAULT 10737418240; -- Default 10 GB per member
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS member_storage_limit_bytes BIGINT DEFAULT 5368709120; -- Default 5 GB per member for Free
