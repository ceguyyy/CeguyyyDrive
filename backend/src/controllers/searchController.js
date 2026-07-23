const { z } = require('zod');
const searchService = require('../services/searchService');

const searchSchema = z.object({
    q: z.string().min(1).max(255).optional(),
    type: z.string().max(100).optional()
});

exports.search = async (req, res, next) => {
    try {
        const { q, type } = searchSchema.parse(req.query);

        if (!q && !type) {
            return res.status(400).json({
                status: 'fail',
                message: 'Must provide a search query (q) or a file type (type)'
            });
        }

        const results = await searchService.performSearch(q, type, req.user.id);
        
        res.status(200).json({
            status: 'success',
            data: results
        });
    } catch (err) {
        next(err);
    }
};
