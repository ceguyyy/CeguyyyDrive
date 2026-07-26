-- Migration 011: Add per-member custom storage limit
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS storage_limit BIGINT DEFAULT NULL;
