-- Account status, so a Super Admin can suspend a user's ability to sign in.
--
-- Enforced in three places, because any one alone leaves a hole:
--   authService.login          — blocks the password step
--   authService.verifyLoginOtp — blocks a code issued just before suspension
--   authMiddleware.protect     — invalidates tokens already in circulation,
--                                otherwise a suspended user keeps working until
--                                their JWT happens to expire.

ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP WITH TIME ZONE;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_status_check'
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT users_status_check CHECK (status IN ('active', 'suspended'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
