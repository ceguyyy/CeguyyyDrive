const { z } = require('zod');
const trashService = require('../services/trashService');

const restoreSchema = z.object({
    type: z.enum(['file', 'folder']),
    id: z.string().uuid()
});

exports.getTrash = async (req, res, next) => {
    try {
        const trash = await trashService.getTrash(req.user.id);
        
        res.status(200).json({
            status: 'success',
            data: trash
        });
    } catch (err) {
        next(err);
    }
};

exports.restoreItem = async (req, res, next) => {
    try {
        const { type, id } = restoreSchema.parse(req.body);
        const restoredItem = await trashService.restoreItem(type, id, req.user.id);
        
        res.status(200).json({
            status: 'success',
            data: { restoredItem }
        });
    } catch (err) {
        next(err);
    }
};

exports.emptyTrash = async (req, res, next) => {
    try {
        const result = await trashService.emptyTrash(req.user.id);
        
        res.status(200).json({
            status: 'success',
            message: 'Trash emptied successfully',
            data: result
        });
    } catch (err) {
        next(err);
    }
};
