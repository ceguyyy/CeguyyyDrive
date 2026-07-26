-- Let an API key target a user's Personal Drive instead of an organization.
--
-- organization_id NULL now means "personal": the key acts on the drive of the
-- user in created_by. created_by therefore becomes mandatory — a key with
-- neither an organization nor a user would address nothing at all.
ALTER TABLE api_keys ALTER COLUMN organization_id DROP NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'api_keys_target_check'
    ) THEN
        ALTER TABLE api_keys
            ADD CONSTRAINT api_keys_target_check
            CHECK (organization_id IS NOT NULL OR created_by IS NOT NULL);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_api_keys_personal
    ON api_keys(created_by) WHERE organization_id IS NULL;
