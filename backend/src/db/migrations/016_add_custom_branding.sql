-- Migration 016: Add custom branding (app title & logo url) to organizations and org_licenses
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS custom_app_title VARCHAR(255);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS custom_logo_url TEXT;

ALTER TABLE org_licenses ADD COLUMN IF NOT EXISTS custom_app_title VARCHAR(255);
ALTER TABLE org_licenses ADD COLUMN IF NOT EXISTS custom_logo_url TEXT;
