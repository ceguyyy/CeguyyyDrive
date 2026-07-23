const { z } = require('zod');
const versionService = require('../services/versionService');

const finalizeVersionSchema = z.object({
    storageKey: z.string().min(1),
    size: z.number().int().nonnegative()
});

exports.getVersions = async (req, res, next) => {
    try {
        const fileId = req.params.fileId;
        const versions = await versionService.getVersions(fileId, req.user.id);
        
        res.status(200).json({
            status: 'success',
            data: { versions }
        });
    } catch (err) {
        next(err);
    }
};

exports.getDownloadUrl = async (req, res, next) => {
    try {
        const versionId = req.params.id;
        const downloadUrl = await versionService.getDownloadUrl(versionId, req.user.id);
        
        res.status(200).json({
            status: 'success',
            data: { downloadUrl }
        });
    } catch (err) {
        next(err);
    }
};

exports.restoreVersion = async (req, res, next) => {
    try {
        const versionId = req.params.id;
        const file = await versionService.restoreVersion(versionId, req.user.id);
        
        res.status(200).json({
            status: 'success',
            data: { file }
        });
    } catch (err) {
        next(err);
    }
};

exports.deleteVersion = async (req, res, next) => {
    try {
        const versionId = req.params.id;
        await versionService.deleteVersion(versionId, req.user.id);
        
        res.status(204).send();
    } catch (err) {
        next(err);
    }
};

exports.finalizeNewVersion = async (req, res, next) => {
    try {
        const fileId = req.params.fileId;
        const { storageKey, size } = finalizeVersionSchema.parse(req.body);

        const file = await versionService.registerNewVersion(fileId, req.user.id, storageKey, size);

        res.status(200).json({
            status: 'success',
            data: { file }
        });
    } catch (err) {
        next(err);
    }
};
