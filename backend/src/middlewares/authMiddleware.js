const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const userRepository = require('../repositories/userRepository');
const AppError = require('../utils/AppError');

exports.protect = async (req, res, next) => {
    try {
        // 1. Get token from header
        let token;
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return next(new AppError('You are not logged in! Please log in to get access.', 401));
        }

        // 2. Verify token
        const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

        // 3. Check if user still exists
        const currentUser = await userRepository.findById(decoded.id);
        if (!currentUser) {
            return next(new AppError('The user belonging to this token no longer exists.', 401));
        }

        // Checked on every request, not just at login: without this a suspended
        // user keeps working until their existing JWT happens to expire.
        if (currentUser.status === 'suspended') {
            return next(new AppError('Your account has been suspended. Contact your administrator.', 403));
        }

        // A password reset must evict whoever prompted it. `iat` is in seconds;
        // the 1s allowance covers a token minted in the same second as the change.
        if (currentUser.password_changed_at) {
            const changedAtSeconds = Math.floor(new Date(currentUser.password_changed_at).getTime() / 1000);
            if (decoded.iat && decoded.iat + 1 < changedAtSeconds) {
                return next(new AppError('Your password was changed. Please log in again.', 401));
            }
        }

        // Grant access to protected route
        req.user = currentUser;
        next();
    } catch (err) {
        if (err.name === 'JsonWebTokenError') {
            return next(new AppError('Invalid token. Please log in again!', 401));
        }
        if (err.name === 'TokenExpiredError') {
            return next(new AppError('Your token has expired! Please log in again.', 401));
        }
        next(err);
    }
};

exports.restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role_name)) {
            return next(new AppError('You do not have permission to perform this action', 403));
        }
        next();
    };
};
