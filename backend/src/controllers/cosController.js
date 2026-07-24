const { z } = require('zod');
const cosService = require('../services/cosService');
const fileService = require('../services/fileService');

const uploadUrlSchema = z.object({
    fileName: z.string().min(1).max(255),
    size: z.number().int().nonnegative(),
    mimeType: z.string().min(1).max(100),
    folderId: z.string().uuid().nullable().optional()
});

exports.generateUploadUrl = async (req, res, next) => {
    try {
        const { fileName, size, mimeType, folderId } = uploadUrlSchema.parse(req.body);
        
        // 1. Generate unique object key
        const storageKey = cosService.generateObjectKey(req.user.id, fileName);

        // 2. We could create an "upload_session" or a pending file record here, 
        // but for simplicity, we will create the file record immediately, 
        // assuming the client will fulfill the upload. 
        // Alternatively, the client should call POST /files after a successful PUT.
        // Let's create the file metadata right now to reserve the name.
        const file = await fileService.createFileRecord(
            fileName, size, mimeType, storageKey, folderId, req.user.id
        );

        // 3. Generate the presigned URL
        const uploadUrl = await cosService.getPresignedUploadUrl(storageKey);

        res.status(200).json({
            status: 'success',
            data: {
                uploadUrl,
                fileId: file.id,
                storageKey
            }
        });
    } catch (err) {
        next(err);
    }
};

exports.generateDownloadUrl = async (req, res, next) => {
    try {
        const fileId = req.params.fileId;
        
        // 1. Validate the user owns this file or has received access via share
        const file = await fileService.getAccessibleFile(fileId, req.user.id);

        // 2. Generate the presigned URL using the storage_key with inline disposition
        const downloadUrl = await cosService.getPresignedDownloadUrl(file.storage_key, true, file.mime_type);

        res.status(200).json({
            status: 'success',
            data: {
                downloadUrl
            }
        });
    } catch (err) {
        next(err);
    }
};

exports.generateVersionUploadUrl = async (req, res, next) => {
    try {
        const fileId = req.params.fileId;
        const file = await fileService.getFile(fileId, req.user.id);
        
        // Generate a new storage key for the new version
        const newStorageKey = cosService.generateObjectKey(req.user.id, file.original_name);
        const uploadUrl = await cosService.getPresignedUploadUrl(newStorageKey);

        res.status(200).json({
            status: 'success',
            data: {
                uploadUrl,
                storageKey: newStorageKey
            }
        });
    } catch (err) {
        next(err);
    }
};

exports.generateProfilePictureUploadUrl = async (req, res, next) => {
    try {
        const { fileName } = req.body;
        if (!fileName) {
            return res.status(400).json({ status: 'fail', message: 'fileName is required' });
        }
        
        // Use a specific prefix to easily identify profile pictures in the bucket
        const storageKey = `profile_pictures/${req.user.id}_${Date.now()}_${fileName}`;
        const uploadUrl = await cosService.getPresignedUploadUrl(storageKey);

        res.status(200).json({
            status: 'success',
            data: {
                uploadUrl,
                storageKey
            }
        });
    } catch (err) {
        next(err);
    }
};
