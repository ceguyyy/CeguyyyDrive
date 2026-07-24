-- Migration 007: Add access_key to users table for Open Beta invitation codes
ALTER TABLE users ADD COLUMN IF NOT EXISTS access_key VARCHAR(100);
