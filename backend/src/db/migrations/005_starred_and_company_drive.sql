-- Partial unique index for starring files cleanly
CREATE UNIQUE INDEX IF NOT EXISTS idx_favorites_user_file_unique ON favorites(user_id, file_id) WHERE file_id IS NOT NULL;

-- Make folders.user_id nullable for Company Drive role root folders
ALTER TABLE folders ALTER COLUMN user_id DROP NOT NULL;

-- Add organization_id and owner_role_id to folders
ALTER TABLE folders ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE folders ADD COLUMN IF NOT EXISTS owner_role_id UUID REFERENCES organization_roles(id) ON DELETE SET NULL;

-- Add organization_id to files
ALTER TABLE files ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Create indexes for Company Drive queries
CREATE INDEX IF NOT EXISTS idx_folders_org_id ON folders(organization_id);
CREATE INDEX IF NOT EXISTS idx_folders_owner_role_id ON folders(owner_role_id);
CREATE INDEX IF NOT EXISTS idx_files_org_id ON files(organization_id);
