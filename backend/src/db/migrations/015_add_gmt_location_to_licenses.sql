-- Migration 015: Add gmt_location (timezone) to org_licenses and organizations tables
ALTER TABLE org_licenses ADD COLUMN IF NOT EXISTS gmt_location VARCHAR(100) DEFAULT 'GMT+7 (Asia/Jakarta)';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS gmt_location VARCHAR(100) DEFAULT 'GMT+7 (Asia/Jakarta)';
