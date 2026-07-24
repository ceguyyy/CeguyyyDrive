const { z } = require('zod');
const folderService = require('../services/folderService');

const createFolderSchema = z.object({
    name: z.string().min(1).max(255),
    parentId: z.string().uuid().nullable().optional()
});

const updateFolderSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    parentId: z.string().uuid().nullable().optional()
});

exports.createFolder = async (req, res, next) => {
    try {
        const { name, parentId } = createFolderSchema.parse(req.body);
        const folder = await folderService.createFolder(name, parentId, req.user.id);
        
        res.status(201).json({
            status: 'success',
            data: { folder }
        });
    } catch (err) {
        next(err);
    }
};

exports.listFolders = async (req, res, next) => {
    try {
        const parentId = req.query.parentId || null;
        if (parentId && !z.string().uuid().safeParse(parentId).success) {
            return res.status(400).json({ status: 'fail', message: 'Invalid parentId UUID' });
        }

        const folders = await folderService.listFolders(parentId, req.user.id);
        
        res.status(200).json({
            status: 'success',
            results: folders.length,
            data: { folders }
        });
    } catch (err) {
        next(err);
    }
};

exports.getFolder = async (req, res, next) => {
    try {
        const id = req.params.id;
        const actualFolderId = id === 'root' ? null : id;
        
        // Fetch folder metadata if not root
        let folder = null;
        let ancestors = [];
        if (actualFolderId) {
            folder = await folderService.getFolder(actualFolderId, req.user.id);
            ancestors = await folderService.getAncestors(actualFolderId, req.user.id);
        }
        
        // Import fileService locally if not imported at top
        const fileService = require('../services/fileService');
        
        // Fetch subfolders and files
        const subfolders = await folderService.listFolders(actualFolderId, req.user.id);
        const files = await fileService.listFiles(actualFolderId, req.user.id);
        
        res.status(200).json({
            status: 'success',
            data: { 
                folder,
                ancestors,
                subfolders,
                files
            }
        });
    } catch (err) {
        next(err);
    }
};

exports.updateFolder = async (req, res, next) => {
    try {
        const id = req.params.id;
        const { name, parentId } = updateFolderSchema.parse(req.body);
        
        const folder = await folderService.updateFolder(id, name, parentId, req.user.id);
        
        res.status(200).json({
            status: 'success',
            data: { folder }
        });
    } catch (err) {
        next(err);
    }
};

exports.copyFolder = async (req, res, next) => {
    try {
        const { destinationFolderId } = req.body; // Can be null for root
        if (destinationFolderId && !z.string().uuid().safeParse(destinationFolderId).success) {
            return res.status(400).json({ status: 'fail', message: 'Invalid destinationFolderId UUID' });
        }

        const folder = await folderService.copyFolder(req.params.id, req.user.id, destinationFolderId || null);
        
        res.status(200).json({
            status: 'success',
            data: { folder }
        });
    } catch (err) {
        next(err);
    }
};

exports.deleteFolder = async (req, res, next) => {
    try {
        const id = req.params.id;
        await folderService.deleteFolder(id, req.user.id);
        
        res.status(204).send();
    } catch (err) {
        next(err);
    }
};
