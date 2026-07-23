const { z } = require('zod');
const shareService = require('../services/shareService');

const createShareSchema = z.object({
    fileId: z.string().uuid().nullable().optional(),
    folderId: z.string().uuid().nullable().optional(),
    expiresAt: z.string().datetime().nullable().optional(),
    password: z.string().min(4).nullable().optional()
});

exports.generateShareLink = async (req, res, next) => {
    try {
        const { fileId, folderId, expiresAt, password } = createShareSchema.parse(req.body);
        const share = await shareService.generateShareLink(fileId, folderId, req.user.id, expiresAt, password);
        
        res.status(201).json({
            status: 'success',
            data: { share }
        });
    } catch (err) {
        next(err);
    }
};

exports.accessSharedResource = async (req, res, next) => {
    try {
        const token = req.params.token;
        
        // Passwords can be passed via query string or body depending on frontend implementation.
        // For a GET request, it's typically sent in headers or query.
        const password = req.query.password || req.headers['x-share-password'];

        const resource = await shareService.accessSharedResource(token, password);
        
        res.status(200).json({
            status: 'success',
            data: resource
        });
    } catch (err) {
        next(err);
    }
};

exports.listShares = async (req, res, next) => {
    try {
        const fileId = req.query.fileId;
        const folderId = req.query.folderId;
        
        const shares = await shareService.listSharesByResource(fileId, folderId, req.user.id);
        
        res.status(200).json({
            status: 'success',
            results: shares.length,
            data: { shares }
        });
    } catch (err) {
        next(err);
    }
};

exports.revokeShare = async (req, res, next) => {
    try {
        const id = req.params.id;
        await shareService.revokeShare(id, req.user.id);
        
        res.status(204).send();
    } catch (err) {
        next(err);
    }
};
