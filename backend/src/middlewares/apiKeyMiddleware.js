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

        // Organization keys only. A Personal Drive key has no organization, so
        // there is no billing feature to gate it — it reaches nothing but the
        // creator's own drive.
        if (!context.isPersonal) {
            // Checked per request, not just when the sidebar renders: switching
            // the feature off in Billing must immediately kill keys already in
            // the wild.
            const org = await organizationRepository.findOrganizationById(context.organizationId);
            if (!org || !org.feature_integration_enabled) {
                return next(new AppError('The Integration feature is not enabled for this organization.', 403));
            }
        }

        req.apiKey = context;

        // Fire-and-forget: usage tracking must not fail or delay the request.
        apiKeyRepository.touchLastUsed(context.keyId).catch(() => {});

        next();
    } catch (err) {
        next(err);
    }
};

// Organization endpoints have no meaning for a Personal Drive key: there is no
// organization to read, no members to invite, and no approval flow to join.
exports.requireOrganizationKey = (req, res, next) => {
    if (req.apiKey?.isPersonal) {
        return next(new AppError(
            'This endpoint needs an organization API key. The key you used targets a Personal Drive.',
            403
        ));
    }
    next();
};

exports.requireScope = (scope) => (req, res, next) => {
    if (!req.apiKey?.scopes?.includes(scope)) {
        return next(new AppError(`This API key lacks the "${scope}" scope.`, 403));
    }
    next();
};
