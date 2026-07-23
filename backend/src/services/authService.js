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

    async register(email, password, fullName, roleName = 'user') {
        const existingUser = await userRepository.findByEmail(email);
        if (existingUser) {
            throw new AppError('Email is already in use', 400);
        }

        const role = await roleRepository.findByName(roleName);
        if (!role) {
            throw new AppError(`Role ${roleName} not found`, 400);
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const newUser = await userRepository.create(email, passwordHash, fullName, role.id);
        
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
