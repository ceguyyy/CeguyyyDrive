-- Migration 009: Create org_licenses table and add billing columns to organizations table

CREATE TABLE IF NOT EXISTS org_licenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    license_key VARCHAR(100) UNIQUE NOT NULL,
    owner_email VARCHAR(255) NOT NULL,
    plan_name VARCHAR(50) DEFAULT 'Pro',
    storage_limit_bytes BIGINT DEFAULT 10737418240, -- 10 GB default
    max_members INT DEFAULT 25,
    feature_approval_enabled BOOLEAN DEFAULT true,
    feature_chat_enabled BOOLEAN DEFAULT true,
    status VARCHAR(50) DEFAULT 'available', -- available, redeemed, revoked
    redeemed_by_org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_org_licenses_key ON org_licenses(license_key);
CREATE INDEX IF NOT EXISTS idx_org_licenses_email ON org_licenses(LOWER(owner_email));
CREATE INDEX IF NOT EXISTS idx_org_licenses_status ON org_licenses(status);

CREATE TRIGGER update_org_licenses_updated_at
BEFORE UPDATE ON org_licenses
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add billing & feature enforcement columns to organizations table
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS license_key VARCHAR(100);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS plan_name VARCHAR(50) DEFAULT 'Free';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS storage_limit_bytes BIGINT DEFAULT 5368709120; -- 5 GB default for Free
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS max_members INT DEFAULT 5; -- 5 members default for Free
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS feature_approval_enabled BOOLEAN DEFAULT true;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS feature_chat_enabled BOOLEAN DEFAULT true;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active'; -- active, suspended, trial
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS billing_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_organizations_status ON organizations(status);
CREATE INDEX IF NOT EXISTS idx_organizations_license_key ON organizations(license_key);
