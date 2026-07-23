const { z } = require('zod');
const fileService = require('../services/fileService');

// This schema is for creating the metadata record explicitly (mostly for testing/internal use)
// In Phase 7, the actual upload flow will generate the objectKey directly via COS presigned URLs
const createFileSchema = z.object({
    name: z.string().min(1).max(255),
    size: z.number().int().nonnegative(),
    mimeType: z.string().min(1).max(100),
    objectKey: z.string().min(1).max(1024),
    folderId: z.string().uuid().nullable().optional()
});

const updateFileSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    folderId: z.string().uuid().nullable().optional()
});

exports.createFileRecord = async (req, res, next) => {
    try {
        const { name, size, mimeType, objectKey, folderId } = createFileSchema.parse(req.body);
        const file = await fileService.createFileRecord(name, size, mimeType, objectKey, folderId, req.user.id);
        
        res.status(201).json({
            status: 'success',
            data: { file }
        });
    } catch (err) {
        next(err);
    }
};

exports.listFiles = async (req, res, next) => {
    try {
        const folderId = req.query.folderId || null;
        if (folderId && !z.string().uuid().safeParse(folderId).success) {
            return res.status(400).json({ status: 'fail', message: 'Invalid folderId UUID' });
        }

        const files = await fileService.listFiles(folderId, req.user.id);
        
        res.status(200).json({
            status: 'success',
            results: files.length,
            data: { files }
        });
    } catch (err) {
        next(err);
    }
};

exports.getFile = async (req, res, next) => {
    try {
        const id = req.params.id;
        const file = await fileService.getFile(id, req.user.id);
        
        res.status(200).json({
            status: 'success',
            data: { file }
        });
    } catch (err) {
        next(err);
    }
};

exports.updateFile = async (req, res, next) => {
    try {
        const { name, folderId } = updateFileSchema.parse(req.body);
        const file = await fileService.updateFile(req.params.id, req.user.id, name, folderId);
        
        res.status(200).json({
            status: 'success',
            data: { file }
        });
    } catch (err) {
        next(err);
    }
};

exports.copyFile = async (req, res, next) => {
    try {
        const { destinationFolderId } = req.body; // Can be null for root
        if (destinationFolderId && !z.string().uuid().safeParse(destinationFolderId).success) {
            return res.status(400).json({ status: 'fail', message: 'Invalid destinationFolderId UUID' });
        }

        const file = await fileService.copyFile(req.params.id, req.user.id, destinationFolderId || null);
        
        res.status(200).json({
            status: 'success',
            data: { file }
        });
    } catch (err) {
        next(err);
    }
};

exports.deleteFile = async (req, res, next) => {
    try {
        const id = req.params.id;
        await fileService.deleteFile(id, req.user.id);
        
        res.status(204).send();
    } catch (err) {
        next(err);
    }
};
