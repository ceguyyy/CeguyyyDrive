const crypto = require('crypto');
const bcrypt = require('bcrypt');
const shareRepository = require('../repositories/shareRepository');
const fileRepository = require('../repositories/fileRepository');
const folderRepository = require('../repositories/folderRepository');
const userRepository = require('../repositories/userRepository');
const notificationRepository = require('../repositories/notificationRepository');
const cosService = require('./cosService');
const AppError = require('../utils/AppError');

class ShareService {
    async generateShareLink(fileId, folderId, userId, expiresAt, password, targetEmail) {
        if (!fileId && !folderId) {
            throw new AppError('Must share either a file or a folder', 400);
        }

        let itemName = 'an item';

        // Verify ownership
        if (fileId) {
            const file = await fileRepository.findByIdAndUser(fileId, userId);
            if (!file) throw new AppError('File not found', 404);
            itemName = file.original_name;
        } else if (folderId) {
            const folder = await folderRepository.findByIdAndUser(folderId, userId);
            if (!folder) throw new AppError('Folder not found', 404);
            itemName = folder.name;
        }

        let sharedWithUser = null;
        if (targetEmail) {
            const recipient = await userRepository.findByEmail(targetEmail.trim().toLowerCase());
            if (!recipient) {
                throw new AppError(`User with email "${targetEmail}" was not found`, 404);
            }
            if (recipient.id === userId) {
                throw new AppError('You cannot share an item with yourself', 400);
            }
            sharedWithUser = recipient;
        }

        // Generate unique 32-character token
        const token = crypto.randomBytes(16).toString('hex');
        
        let passwordHash = null;
        if (password) {
            passwordHash = await bcrypt.hash(password, 10);
        }

        const share = await shareRepository.create(
            token, 
            fileId, 
            folderId, 
            userId, 
            expiresAt, 
            passwordHash, 
            sharedWithUser ? sharedWithUser.id : null
        );

        // If shared directly with a user by email, create an inbox notification
        if (sharedWithUser) {
            const sender = await userRepository.findById(userId);
            const senderName = sender?.full_name || 'Someone';
            const title = 'New Item Shared';
            const message = `${senderName} shared "${itemName}" with you.`;

            await notificationRepository.create(
                sharedWithUser.id,
                userId,
                title,
                message,
                'share',
                '/shared'
            );
        }

        return share;
    }

    async accessSharedResource(token, password) {
        const share = await shareRepository.findByToken(token);
        if (!share) {
            throw new AppError('Invalid or expired share link', 404);
        }

        if (share.expires_at && new Date() > new Date(share.expires_at)) {
            throw new AppError('Share link has expired', 410);
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
            const db = require('../config/db');
            const folderResult = await db.query('SELECT * FROM folders WHERE id = $1 AND is_deleted = false', [share.folder_id]);
            const folder = folderResult.rows[0];
            
            if (!folder) {
                throw new AppError('Shared folder no longer exists', 404);
            }

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

    async getReceivedShares(userId) {
        return await shareRepository.findReceivedShares(userId);
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
