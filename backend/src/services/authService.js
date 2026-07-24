const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const userRepository = require('../repositories/userRepository');
const roleRepository = require('../repositories/roleRepository');
const AppError = require('../utils/AppError');

class AuthService {
    _signToken(id, role_name, type) {
        const secret = type === 'access' ? process.env.JWT_SECRET : process.env.JWT_REFRESH_SECRET;
        const expiresIn = type === 'access' ? '15m' : '7d';
        return jwt.sign({ id, role: role_name }, secret, { expiresIn });
    }

    async register(email, password, fullName, roleName = 'user', accessKey = null) {
        const DEFAULT_BETA_KEYS = ['BETA2026', 'CEGUYYY-BETA', 'OPENVIP', 'BETA100', 'VIP2026'];
        const envKeys = process.env.BETA_ACCESS_KEYS 
            ? process.env.BETA_ACCESS_KEYS.split(',').map(k => k.trim().toUpperCase())
            : DEFAULT_BETA_KEYS;

        if (!accessKey || typeof accessKey !== 'string') {
            throw new AppError('Open Beta Access Key is required for registration', 400);
        }

        const formattedKey = accessKey.trim().toUpperCase();
        if (!envKeys.includes(formattedKey)) {
            throw new AppError('Invalid Open Beta Access Key. Please provide a valid invitation code to join.', 400);
        }

        const existingUser = await userRepository.findByEmail(email);
        if (existingUser) {
            throw new AppError('Email is already in use', 400);
        }

        const role = await roleRepository.findByName(roleName);
        if (!role) {
            throw new AppError(`Role ${roleName} not found`, 400);
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const newUser = await userRepository.create(email, passwordHash, fullName, role.id, formattedKey);
        
        newUser.role_name = role.name;

        const accessToken = this._signToken(newUser.id, newUser.role_name, 'access');
        const refreshToken = this._signToken(newUser.id, newUser.role_name, 'refresh');

        return { user: newUser, accessToken, refreshToken };
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

        const accessToken = this._signToken(user.id, user.role_name, 'access');
        const refreshToken = this._signToken(user.id, user.role_name, 'refresh');

        // Remove password hash from output
        delete user.password_hash;

        return { user, accessToken, refreshToken };
    }
}

module.exports = new AuthService();
