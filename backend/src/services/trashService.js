const fileRepository = require('../repositories/fileRepository');
const folderRepository = require('../repositories/folderRepository');
const cosService = require('./cosService');
const AppError = require('../utils/AppError');

class TrashService {
    async getTrash(userId) {
        const trashedFiles = await fileRepository.findTrashedByUser(userId);
        const trashedFolders = await folderRepository.findTrashedByUser(userId);
        
        return {
            files: trashedFiles,
            folders: trashedFolders
        };
    }

    async restoreItem(type, id, userId) {
        if (type === 'file') {
            const file = await fileRepository.restore(id, userId);
            if (!file) throw new AppError('File not found in trash', 404);
            return file;
        } else if (type === 'folder') {
            const folder = await folderRepository.restore(id, userId);
            if (!folder) throw new AppError('Folder not found in trash', 404);
            return folder;
        } else {
            throw new AppError('Invalid item type', 400);
        }
    }

    async emptyTrash(userId) {
        const trashedFiles = await fileRepository.findTrashedByUser(userId);
        const trashedFolders = await folderRepository.findTrashedByUser(userId);

        // 1. Permanently delete all files from Tencent COS
        for (const file of trashedFiles) {
            if (file.storage_key) {
                await cosService.deleteObject(file.storage_key);
            }
        }

        // 2. Hard delete all trashed files from database
        for (const file of trashedFiles) {
            await fileRepository.hardDelete(file.id, userId);
        }

        // 3. Hard delete all trashed folders from database
        for (const folder of trashedFolders) {
            await folderRepository.hardDelete(folder.id, userId);
        }

        return {
            deletedFilesCount: trashedFiles.length,
            deletedFoldersCount: trashedFolders.length
        };
    }
}

module.exports = new TrashService();
