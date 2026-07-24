const orgDriveService = require('../services/orgDriveService');

exports.listDriveContents = async (req, res, next) => {
    try {
        const { orgId } = req.params;
        const folderId = req.params.folderId || req.query.folderId || null;
        const contents = await orgDriveService.listDriveContents(orgId, folderId, req.user.id);
        res.status(200).json({
            status: 'success',
            data: contents
        });
    } catch (err) {
        next(err);
    }
};

exports.createSubfolder = async (req, res, next) => {
    try {
        const { orgId } = req.params;
        const { name, parentFolderId } = req.body;
        const folder = await orgDriveService.createSubfolder(orgId, name, parentFolderId, req.user.id);
        res.status(201).json({
            status: 'success',
            data: { folder }
        });
    } catch (err) {
        next(err);
    }
};

exports.generateUploadUrl = async (req, res, next) => {
    try {
        const { orgId } = req.params;
        const { name, size, mimeType, folderId } = req.body;
        const result = await orgDriveService.generateUploadUrl(orgId, name, size, mimeType, folderId, req.user.id);
        res.status(200).json({
            status: 'success',
            data: result
        });
    } catch (err) {
        next(err);
    }
};

exports.generateDownloadUrl = async (req, res, next) => {
    try {
        const { orgId, fileId } = req.params;
        const result = await orgDriveService.generateDownloadUrl(orgId, fileId, req.user.id);
        res.status(200).json({
            status: 'success',
            data: result
        });
    } catch (err) {
        next(err);
    }
};

exports.renameFolder = async (req, res, next) => {
    try {
        const { orgId, id } = req.params;
        const { name } = req.body;
        const folder = await orgDriveService.renameFolder(orgId, id, name, req.user.id);
        res.status(200).json({
            status: 'success',
            data: { folder }
        });
    } catch (err) {
        next(err);
    }
};

exports.renameFile = async (req, res, next) => {
    try {
        const { orgId, id } = req.params;
        const { name } = req.body;
        const file = await orgDriveService.renameFile(orgId, id, name, req.user.id);
        res.status(200).json({
            status: 'success',
            data: { file }
        });
    } catch (err) {
        next(err);
    }
};

exports.softDeleteFolder = async (req, res, next) => {
    try {
        const { orgId, id } = req.params;
        await orgDriveService.softDeleteFolder(orgId, id, req.user.id);
        res.status(204).send();
    } catch (err) {
        next(err);
    }
};

exports.softDeleteFile = async (req, res, next) => {
    try {
        const { orgId, id } = req.params;
        await orgDriveService.softDeleteFile(orgId, id, req.user.id);
        res.status(204).send();
    } catch (err) {
        next(err);
    }
};

exports.getTrashedItems = async (req, res, next) => {
    try {
        const { orgId } = req.params;
        const items = await orgDriveService.getTrashedItems(orgId, req.user.id);
        res.status(200).json({
            status: 'success',
            data: items
        });
    } catch (err) {
        next(err);
    }
};

exports.restoreItem = async (req, res, next) => {
    try {
        const { orgId, type, id } = req.params;
        const item = await orgDriveService.restoreItem(orgId, type, id, req.user.id);
        res.status(200).json({
            status: 'success',
            data: { item }
        });
    } catch (err) {
        next(err);
    }
};
