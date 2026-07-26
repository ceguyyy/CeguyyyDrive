const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const userRepository = require('../repositories/userRepository');
const passwordResetRepository = require('../repositories/passwordResetRepository');
const roleRepository = require('../repositories/roleRepository');
const otpRepository = require('../repositories/otpRepository');
const telegramService = require('./telegramService');
const plunkService = require('./plunkService');
const billingRepository = require('../repositories/billingRepository');
const organizationService = require('./organizationService');
const organizationRepository = require('../repositories/organizationRepository');
const AppError = require('../utils/AppError');

// Longer than the 5-minute login OTP: a reset means switching to an email
// client and back, and the code is single-use and attempt-limited anyway.
const PASSWORD_RESET_TTL_MINUTES = 15;
const MAX_RESET_ATTEMPTS = 5;

class AuthService {
    _signToken(id, role_name, type) {
        const secret = type === 'access' ? process.env.JWT_SECRET : process.env.JWT_REFRESH_SECRET;
        // Tunable without a code change; 24h keeps users signed in for a full
        // working day, which matters because there is no token-refresh flow.
        const expiresIn = type === 'access'
            ? (process.env.JWT_ACCESS_EXPIRES_IN || '24h')
            : (process.env.JWT_REFRESH_EXPIRES_IN || '7d');
        return jwt.sign({ id, role: role_name }, secret, { expiresIn });
    }

    async register(email, password, fullName, roleName = 'user', accessKey = null, secondaryAccessKey = null, licenseKey = null, orgName = null, orgId = null) {
        const PRIMARY_KEY = process.env.PRIMARY_BETA_KEY || 'pTfk4VRWSgWi5CbpT5Vabx2v7vNPYAmSzCsAWa5mZePGg';
        const SECONDARY_KEY = process.env.SECONDARY_BETA_KEY || 'mSzCsAWa5mZePGg';

        const existingUser = await userRepository.findByEmail(email);
        if (existingUser) {
            throw new AppError('Email is already in use', 400);
        }

        let assignedRoleName = 'user';
        let redeemedLicense = null;
        let targetOrgId = orgId;
        let targetOrgName = orgName;

        if (licenseKey && licenseKey.trim()) {
            // Organization Owner Registration (New Org via License Key)
            const license = await billingRepository.findAvailableLicenseByKey(licenseKey);
            if (!license) {
                throw new AppError('Invalid or already redeemed Organization License Key', 400);
            }
            if (license.owner_email && license.owner_email.trim().toLowerCase() !== email.trim().toLowerCase()) {
                throw new AppError(`This License Key is registered to a different email address (${license.owner_email})`, 403);
            }
            redeemedLicense = license;
            assignedRoleName = 'user'; // System role is user; Organization role will be Owner
        } else if (orgId && orgId.trim()) {
            // Regular Employee / Member joining an existing org
            const org = await organizationRepository.findOrganizationById(orgId.trim());
            if (!org) {
                throw new AppError('Organization not found with that ID or Invite Code', 404);
            }
            assignedRoleName = 'user';
        } else if (roleName === 'owner' || roleName === 'super_admin' || roleName === 'super admin' || roleName === 'admin') {
            // Platform Admin / Developer Registration
            if (!accessKey || typeof accessKey !== 'string' || accessKey.trim() !== PRIMARY_KEY) {
                throw new AppError('Invalid Primary Beta Access Key', 400);
            }
            if (!secondaryAccessKey || typeof secondaryAccessKey !== 'string' || secondaryAccessKey.trim() !== SECONDARY_KEY) {
                throw new AppError('Invalid Secondary Beta Access Key', 400);
            }
            assignedRoleName = roleName || 'owner';
        } else {
            throw new AppError('Please select a registration type and provide either a License Key, Organization ID, or Admin Access Keys.', 400);
        }

        const role = await roleRepository.findByName(assignedRoleName);
        if (!role) {
            throw new AppError(`Role ${assignedRoleName} not found`, 400);
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const newUser = await userRepository.create(email, passwordHash, fullName, role.id, accessKey ? accessKey.trim() : null);
        newUser.role_name = role.name;

        // Provision organization or attach membership if applicable
        if (redeemedLicense) {
            const newOrg = await organizationService.createOrganization(
                targetOrgName || `${fullName}'s Workspace`,
                newUser.id,
                {
                    licenseKey: redeemedLicense.license_key,
                    planName: redeemedLicense.plan_name,
                    storageLimitBytes: redeemedLicense.storage_limit_bytes,
                    maxMembers: redeemedLicense.max_members,
                    memberStorageLimitBytes: redeemedLicense.member_storage_limit_bytes,
                    featureApprovalEnabled: redeemedLicense.feature_approval_enabled,
                    featureChatEnabled: redeemedLicense.feature_chat_enabled,
                    maxOrganizations: redeemedLicense.max_organizations,
                    gmtLocation: redeemedLicense.gmt_location || 'GMT+7 (Asia/Jakarta)',
                    customAppTitle: redeemedLicense.custom_app_title || null,
                    customLogoUrl: redeemedLicense.custom_logo_url || null
                },
                // The license grants the first organization; the user has no
                // plan-derived entitlement yet.
                { enforceUserLimit: false }
            );
            await billingRepository.markLicenseRedeemed(redeemedLicense.id, newOrg.id);
        } else if (targetOrgId) {
            const existingMember = await organizationRepository.findMemberByEmail(targetOrgId.trim(), email.trim());
            if (existingMember) {
                await organizationRepository.updateMemberStatus(targetOrgId.trim(), newUser.id, 'accepted');
            } else {
                await organizationRepository.addMember(targetOrgId.trim(), email.trim(), 'Member', newUser.id);
                const newMember = await organizationRepository.findMemberByEmail(targetOrgId.trim(), email.trim());
                if (newMember) await organizationRepository.updateMemberStatus(targetOrgId.trim(), newUser.id, 'accepted');
            }
        }

        // Generate OTP for registration verification
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
        await otpRepository.create(newUser.id, newUser.email, otpCode, expiresAt);
        await telegramService.sendOtpMessage(newUser.email, otpCode);
        await plunkService.sendOtpEmail(newUser.email, otpCode);

        return { user: newUser, requiresOtp: true, email: newUser.email, message: 'OTP verification code sent to your email.' };
    }

    // Always reports success, even for an unknown or suspended address.
    // Reporting otherwise turns this endpoint into an account-enumeration oracle.
    async forgotPassword(email) {
        const GENERIC = 'If that email is registered, a reset code is on its way.';

        const address = String(email || '').trim();
        if (!address) throw new AppError('Email is required', 400);

        const user = await userRepository.findByEmail(address);
        if (!user || user.status === 'suspended') {
            return { message: GENERIC };
        }

        const otpCode = crypto.randomInt(100000, 1000000).toString();
        const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000);

        await passwordResetRepository.create(user.id, user.email, otpCode, expiresAt);
        await plunkService.sendPasswordResetEmail(user.email, otpCode, PASSWORD_RESET_TTL_MINUTES);

        return { message: GENERIC };
    }

    async resetPassword(email, otpCode, newPassword) {
        const address = String(email || '').trim();
        const code = String(otpCode || '').trim();

        if (!address || !code) throw new AppError('Email and reset code are required', 400);
        if (!newPassword || newPassword.length < 8) {
            throw new AppError('New password must be at least 8 characters', 400);
        }

        const record = await passwordResetRepository.findActive(address);
        if (!record) {
            throw new AppError('That reset code is invalid or has expired. Request a new one.', 400);
        }

        if (record.attempts >= MAX_RESET_ATTEMPTS) {
            await passwordResetRepository.markAsUsed(record.id);
            throw new AppError('Too many incorrect attempts. Request a new reset code.', 429);
        }

        if (record.otp_code !== code) {
            const attempts = await passwordResetRepository.incrementAttempts(record.id);
            const remaining = Math.max(0, MAX_RESET_ATTEMPTS - attempts);
            throw new AppError(
                remaining > 0
                    ? `Incorrect reset code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
                    : 'Too many incorrect attempts. Request a new reset code.',
                400
            );
        }

        const user = await userRepository.findByEmail(address);
        if (!user) throw new AppError('User not found', 404);

        const passwordHash = await bcrypt.hash(newPassword, 12);
        await userRepository.updatePassword(user.id, passwordHash);
        await passwordResetRepository.markAsUsed(record.id);

        return { message: 'Password updated. You can now sign in with your new password.' };
    }

    async login(email, password) {
        const user = await userRepository.findByEmail(email);
        if (!user) {
            throw new AppError('Incorrect email or password', 401);
        }

        const isPasswordCorrect = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordCorrect) {
            throw new AppError('Incorrect email or password', 401);
        }

        // Checked after the password so a wrong guess cannot be used to probe
        // which accounts exist and are suspended.
        if (user.status === 'suspended') {
            throw new AppError('Your account has been suspended. Contact your administrator.', 403);
        }

        // Generate 6-digit OTP code
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiration

        await otpRepository.create(user.id, user.email, otpCode, expiresAt);
        await telegramService.sendOtpMessage(user.email, otpCode);
        await plunkService.sendOtpEmail(user.email, otpCode);

        return {
            requiresOtp: true,
            email: user.email,
            message: 'OTP has been sent to your email . It is valid for 5 minutes.'
        };
    }

    async verifyLoginOtp(email, otpCode) {
        if (!email || !otpCode) {
            throw new AppError('Email and OTP code are required', 400);
        }

        const otpRecord = await otpRepository.findValidOtp(email, otpCode.trim());
        if (!otpRecord) {
            throw new AppError('Invalid or expired OTP code (5-minute expiration limit)', 400);
        }

        const user = await userRepository.findByEmail(email);
        if (!user) {
            throw new AppError('User not found', 404);
        }

        // A code issued moments before suspension must not still mint a token.
        if (user.status === 'suspended') {
            throw new AppError('Your account has been suspended. Contact your administrator.', 403);
        }

        await otpRepository.markAsUsed(otpRecord.id);

        const accessToken = this._signToken(user.id, user.role_name, 'access');
        const refreshToken = this._signToken(user.id, user.role_name, 'refresh');

        delete user.password_hash;

        return { user, accessToken, refreshToken };
    }

    async resendOtp(email) {
        if (!email) {
            throw new AppError('Email is required', 400);
        }
        const user = await userRepository.findByEmail(email);
        if (!user) {
            throw new AppError('User not found', 404);
        }
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiration
        await otpRepository.create(user.id, user.email, otpCode, expiresAt);
        await telegramService.sendOtpMessage(user.email, otpCode);
        await plunkService.sendOtpEmail(user.email, otpCode);
        return {
            status: 'success',
            email: user.email,
            message: 'A new 6-digit verification code has been sent to your email.'
        };
    }
}

module.exports = new AuthService();
