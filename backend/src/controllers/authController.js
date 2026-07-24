const { z } = require('zod');
const authService = require('../services/authService');
const captchaService = require('../services/captchaService');
const db = require('../config/db');

const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    fullName: z.string().min(2),
    accessKey: z.string().min(1, "Primary Access key is required"),
    secondaryAccessKey: z.string().min(1, "Secondary Access key is required"),
    role: z.enum(['owner', 'user']).optional(),
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
        const { email, password, fullName, accessKey, secondaryAccessKey, role } = validatedData;

        const result = await authService.register(email, password, fullName, role || 'user', accessKey, secondaryAccessKey);

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

exports.getMe = async (req, res, next) => {
    try {
        const userId = req.user.id;
        
        // Get user details
        const userResult = await db.query(
            'SELECT id, email, full_name, role_id, profile_picture FROM users WHERE id = $1',
            [userId]
        );
        const user = userResult.rows[0];

        // Get storage usage (sum of sizes of all active files for this user)
        const storageResult = await db.query(
            'SELECT COALESCE(SUM(size), 0) AS total_memory FROM files WHERE user_id = $1 AND is_deleted = false',
            [userId]
        );
        const totalMemory = parseInt(storageResult.rows[0].total_memory, 10) || 0;

        let profilePictureUrl = null;
        if (user.profile_picture) {
            const cosService = require('../services/cosService');
            profilePictureUrl = await cosService.getPresignedDownloadUrl(user.profile_picture);
        }

        res.status(200).json({
            status: 'success',
            data: {
                user: {
                    ...user,
                    profile_picture_url: profilePictureUrl
                },
                total_memory: totalMemory
            }
        });
    } catch (err) {
        next(err);
    }
};
