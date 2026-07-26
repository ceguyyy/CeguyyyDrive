const apiKeyService = require('../services/apiKeyService');
const apiKeyRepository = require('../repositories/apiKeyRepository');
const organizationRepository = require('../repositories/organizationRepository');
const AppError = require('../utils/AppError');

/**
 * Authenticates the integration API with an `X-API-Key` header.
 *
 * Deliberately separate from authMiddleware.protect: a key is not a session.
 * It carries no JWT, is bound to exactly one organization, and reaches only the
 * scopes recorded on it.
 */
exports.authenticate = async (req, res, next) => {
    try {
        const header = req.headers['x-api-key']
            || (req.headers.authorization?.startsWith('Bearer cgd_')
                ? req.headers.authorization.slice(7)
                : null);

        if (!header) {
            return next(new AppError('Missing API key. Send it in the X-API-Key header.', 401));
        }

        const context = await apiKeyService.resolve(header);
        if (!context) {
            // One message for unknown, revoked, and expired keys alike: telling
            // them apart would confirm which keys once existed.
            return next(new AppError('Invalid, revoked, or expired API key.', 401));
        }

        // Checked per request, not just when the sidebar renders: switching the
        // feature off in Billing must immediately kill keys already in the wild.
        const org = await organizationRepository.findOrganizationById(context.organizationId);
        if (!org || !org.feature_integration_enabled) {
            return next(new AppError('The Integration feature is not enabled for this organization.', 403));
        }

        req.apiKey = context;

        // Fire-and-forget: usage tracking must not fail or delay the request.
        apiKeyRepository.touchLastUsed(context.keyId).catch(() => {});

        next();
    } catch (err) {
        next(err);
    }
};

exports.requireScope = (scope) => (req, res, next) => {
    if (!req.apiKey?.scopes?.includes(scope)) {
        return next(new AppError(`This API key lacks the "${scope}" scope.`, 403));
    }
    next();
};
