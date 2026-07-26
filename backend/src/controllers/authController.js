const { z } = require('zod');
const authService = require('../services/authService');
const captchaService = require('../services/captchaService');
const userRepository = require('../repositories/userRepository');
const storageQuotaService = require('../services/storageQuotaService');

const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    fullName: z.string().min(2),
    accessKey: z.string().optional().nullable(),
    secondaryAccessKey: z.string().optional().nullable(),
    role: z.enum(['owner', 'user', 'super_admin', 'super admin', 'admin']).optional(),
    roleName: z.enum(['owner', 'user', 'super_admin', 'super admin', 'admin']).optional(),
    licenseKey: z.string().optional().nullable(),
    orgName: z.string().optional().nullable(),
    orgId: z.string().optional().nullable(),
    ticket: z.string().optional(),
    randstr: z.string().optional()
});

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string(),
    ticket: z.string().optional(),
    randstr: z.string().optional()
});

exports.register = async (req, res, next) => {
    try {
        const validatedData = registerSchema.parse(req.body);
        const { email, password, fullName, accessKey, secondaryAccessKey, role, roleName, licenseKey, orgName, orgId } = validatedData;

        const result = await authService.register(email, password, fullName, role || roleName || 'user', accessKey, secondaryAccessKey, licenseKey, orgName, orgId);

        res.status(201).json({
            status: 'success',
            data: result
        });
    } catch (err) {
        next(err);
    }
};

exports.login = async (req, res, next) => {
    try {
        const validatedData = loginSchema.parse(req.body);
        const { email, password } = validatedData;

        const result = await authService.login(email, password);

        res.status(200).json({
            status: 'success',
            data: result
        });
    } catch (err) {
        next(err);
    }
};

const verifyOtpSchema = z.object({
    email: z.string().email(),
    otpCode: z.string().min(6).max(6)
});

exports.verifyOtp = async (req, res, next) => {
    try {
        const { email, otpCode } = verifyOtpSchema.parse(req.body);
        const result = await authService.verifyLoginOtp(email, otpCode);

        res.status(200).json({
            status: 'success',
            data: result
        });
    } catch (err) {
        next(err);
    }
};

const resendOtpSchema = z.object({
    email: z.string().email()
});

exports.resendOtp = async (req, res, next) => {
    try {
        const { email } = resendOtpSchema.parse(req.body);
        const result = await authService.resendOtp(email);

        res.status(200).json({
            status: 'success',
            data: result
        });
    } catch (err) {
        next(err);
    }
};

exports.getMe = async (req, res, next) => {
    try {
        const userId = req.user.id;
        
        // Get user details with role_name
        const user = await userRepository.findById(userId);
        if (user) {
            delete user.password_hash;
        }

        let profilePictureUrl = null;
        if (user.profile_picture) {
            const cosService = require('../services/cosService');
            profilePictureUrl = await cosService.getPresignedDownloadUrl(user.profile_picture);
        }

        // Same source as the upload guard in fileService, so the storage bar
        // and the enforced limit cannot drift apart.
        const { storageLimit, planName, used: totalMemory } =
            await storageQuotaService.getUserStorageUsage(userId, user?.role_name);

        res.status(200).json({
            status: 'success',
            data: {
                user: {
                    ...user,
                    profile_picture_url: profilePictureUrl,
                    storage_limit: storageLimit,
                    plan_name: planName
                },
                total_memory: totalMemory,
                storage_limit: storageLimit,
                plan_name: planName
            }
        });
    } catch (err) {
        next(err);
    }
};
