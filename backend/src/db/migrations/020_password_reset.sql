-- Password reset by emailed one-time code.
--
-- Deliberately a separate table from login_otps rather than a `purpose` column
-- on it: sharing one table would let a login code be replayed as a reset code
-- and vice versa, which turns 2FA into a password-reset primitive.
CREATE TABLE IF NOT EXISTS password_reset_otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    otp_code VARCHAR(10) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_used BOOLEAN NOT NULL DEFAULT false,
    -- A 6-digit code is only 10^6 wide; without a ceiling on guesses an
    -- attacker holding the email address can simply enumerate it.
    attempts INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_password_reset_otps_email ON password_reset_otps(email);

-- Lets authMiddleware reject access tokens minted before the password changed.
-- Without it a reset would not evict whoever prompted the reset: their existing
-- JWT stays valid for its full 24h lifetime.
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP WITH TIME ZONE;
