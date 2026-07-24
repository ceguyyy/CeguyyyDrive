-- Add storage_limit to organization_roles
ALTER TABLE organization_roles ADD COLUMN storage_limit BIGINT;
