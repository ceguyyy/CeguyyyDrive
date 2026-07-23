const crypto = require('crypto');
const bcrypt = require('bcrypt');
const shareRepository = require('../repositories/shareRepository');
const fileRepository = require('../repositories/fileRepository');
const folderRepository = require('../repositories/folderRepository');
const cosService = require('./cosService');
const AppError = require('../utils/AppError');

class ShareService {
    async generateShareLink(fileId, folderId, userId, expiresAt, password) {
        if (!fileId && !folderId) {
            throw new AppError('Must share either a file or a folder', 400);
        }

        // Verify ownership
        if (fileId) {
            const file = await fileRepository.findByIdAndUser(fileId, userId);
            if (!file) throw new AppError('File not found', 404);
        } else if (folderId) {
            const folder = await folderRepository.findByIdAndUser(folderId, userId);
            if (!folder) throw new AppError('Folder not found', 404);
        }

        // Generate unique 32-character token
        const token = crypto.randomBytes(16).toString('hex');
        
        let passwordHash = null;
        if (password) {
            passwordHash = await bcrypt.hash(password, 10);
        }

        return await shareRepository.create(token, fileId, folderId, userId, expiresAt, passwordHash);
    }

    async accessSharedResource(token, password) {
        const share = await shareRepository.findByToken(token);
        if (!share) {
            throw new AppError('Invalid or expired share link', 404);
        }

        if (share.expires_at && new Date() > new Date(share.expires_at)) {
            throw new AppError('Share link has expired', 410); // 410 Gone
        }

        if (share.password_hash) {
            if (!password) {
                throw new AppError('Password required for this share', 401);
            }
            const isPasswordCorrect = await bcrypt.compare(password, share.password_hash);
            if (!isPasswordCorrect) {
                throw new AppError('Incorrect password', 401);
            }
        }

        if (share.file_id) {
            // It's a file share. We bypass the normal fileRepository user check 
            // because we need the object_key, and this is a public link.
            const db = require('../config/db');
            const result = await db.query('SELECT * FROM files WHERE id = $1 AND is_deleted = false', [share.file_id]);
            const file = result.rows[0];

            if (!file) {
                throw new AppError('Shared file no longer exists', 404);
            }

            const downloadUrl = await cosService.getPresignedDownloadUrl(file.storage_key);
            
            return {
                type: 'file',
                file: {
                    id: file.id,
                    name: file.original_name,
                    size: file.size,
                    mime_type: file.mime_type
                },
                downloadUrl
            };
        } else if (share.folder_id) {
            // For folder shares, we would return the folder details and its contents.
            const db = require('../config/db');
            const folderResult = await db.query('SELECT * FROM folders WHERE id = $1 AND is_deleted = false', [share.folder_id]);
            const folder = folderResult.rows[0];
            
            if (!folder) {
                throw new AppError('Shared folder no longer exists', 404);
            }

            // In a full implementation, we'd recursively load contents.
            // For now, return basic metadata.
            return {
                type: 'folder',
                folder: {
                    id: folder.id,
                    name: folder.name
                }
            };
        }
    }

    async listSharesByResource(fileId, folderId, userId) {
        return await shareRepository.findByResourceAndUser(fileId, folderId, userId);
    }

    async revokeShare(id, userId) {
        const deleted = await shareRepository.delete(id, userId);
        if (!deleted) {
            throw new AppError('Share not found', 404);
        }
        return deleted;
    }
}

module.exports = new ShareService();
