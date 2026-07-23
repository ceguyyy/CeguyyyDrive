require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');
const globalErrorHandler = require('./middlewares/errorHandler');
const AppError = require('./utils/AppError');
const routes = require('./routes');

const app = express();

// 1. GLOBAL MIDDLEWARES
// Set security HTTP headers
app.use(helmet());

// Enable CORS
app.use(cors({
    origin: function (origin, callback) {
        callback(null, true);
    },
    credentials: true
}));

// Limit requests from same API
const limiter = rateLimit({
    max: 100, // Limit each IP to 100 requests per `window`
    windowMs: 60 * 1000, // 1 minute
    message: 'Too many requests from this IP, please try again in a minute!'
});
app.use('/v1', limiter);

// Body parser, reading data from body into req.body
app.use(express.json({ limit: '10kb' }));

// 2. ROUTES
app.use('/v1', routes);

// Handle undefined routes
app.use((req, res, next) => {
    next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// 3. GLOBAL ERROR HANDLER
app.use(globalErrorHandler);

// 4. SERVER START
const PORT = process.env.PORT || 8080;
const server = app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}...`);
});

// Handle unhandled rejections globally
process.on('unhandledRejection', err => {
    logger.error('UNHANDLED REJECTION! 💥 Shutting down...');
    logger.error(err.name, err.message);
    server.close(() => {
        process.exit(1);
    });
});
