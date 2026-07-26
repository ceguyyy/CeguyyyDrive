const { z } = require('zod');
const db = require('../config/db');
const AppError = require('../utils/AppError');
const bcrypt = require('bcrypt');

const updateProfileSchema = z.object({
    fullName: z.string().min(2).optional(),
    email: z.string().email().optional(),
    profilePictureKey: z.string().nullable().optional()
});

const updatePasswordSchema = z.object({
    currentPassword: z.string(),
    newPassword: z.string().min(8)
});

exports.updateProfile = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const data = updateProfileSchema.parse(req.body);

        let query = 'UPDATE users SET ';
        const params = [];
        let paramIndex = 1;

        if (data.fullName !== undefined) {
            query += `full_name = $${paramIndex++}, `;
            params.push(data.fullName);
        }
        if (data.email !== undefined) {
            query += `email = $${paramIndex++}, `;
            params.push(data.email);
        }
        if (data.profilePictureKey !== undefined) {
            query += `profile_picture = $${paramIndex++}, `;
            params.push(data.profilePictureKey);
        }

        if (params.length === 0) {
            return res.status(400).json({ status: 'fail', message: 'No fields to update' });
        }

        // Remove trailing comma and space
        query = query.slice(0, -2);
        query += ` WHERE id = $${paramIndex} RETURNING id, email, full_name, role_id, profile_picture`;
        params.push(userId);

        await db.query(query, params);
        
        const userRepository = require('../repositories/userRepository');
        const user = await userRepository.findById(userId);
        if (!user) {
            return next(new AppError('User not found', 404));
        }
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
                }
            }
        });
    } catch (err) {
        next(err);
    }
};

exports.updatePassword = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { currentPassword, newPassword } = updatePasswordSchema.parse(req.body);

        const userResult = await db.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
        if (userResult.rowCount === 0) {
            return next(new AppError('User not found', 404));
        }

        const user = userResult.rows[0];
        const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isMatch) {
            return next(new AppError('Incorrect current password', 401));
        }

        const newHash = await bcrypt.hash(newPassword, 12);
        await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, userId]);

        res.status(200).json({
            status: 'success',
            message: 'Password updated successfully'
        });
    } catch (err) {
        next(err);
    }
};

exports.searchUsers = async (req, res, next) => {
    try {
        const { q } = req.query;
        if (!q) {
            return res.status(200).json({ status: 'success', data: [] });
        }
        
        const query = 'SELECT id, email, full_name, profile_picture FROM users WHERE (email ILIKE $1 OR full_name ILIKE $1) AND id != $2 LIMIT 10';
        const result = await db.query(query, [`%${q}%`, req.user.id]);
        
        const cosService = require('../services/cosService');
        const users = await Promise.all(result.rows.map(async (u) => {
            let url = null;
            if (u.profile_picture) {
                url = await cosService.getPresignedDownloadUrl(u.profile_picture);
            }
            return {
                id: u.id,
                email: u.email,
                full_name: u.full_name,
                profile_picture_url: url
            };
        }));
        
        res.status(200).json({
            status: 'success',
            data: users
        });
    } catch (err) {
        next(err);
    }
};
