const fileRepository = require('../repositories/fileRepository');
const folderRepository = require('../repositories/folderRepository'); // Need to check if folder exists
const path = require('path');
const cosService = require('./cosService');
const AppError = require('../utils/AppError');

class FileService {
    async createFileRecord(originalName, size, mimeType, storageKey, folderId, userId) {
        // Validate folder existence if provided
        if (folderId) {
            const folder = await folderRepository.findByIdAndUser(folderId, userId);
            if (!folder) {
                throw new AppError('Folder not found', 404);
            }
        }

        // Validate uniqueness and generate new name if duplicate
        const existingFiles = await fileRepository.findByFolderAndUser(folderId, userId);
        const existingNames = new Set(existingFiles.map(f => f.original_name));
        
        let finalName = originalName;
        if (existingNames.has(finalName)) {
            const ext = path.extname(originalName);
            const base = path.basename(originalName, ext);
            let counter = 1;
            do {
                finalName = `${base} (${counter})${ext}`;
                counter++;
            } while (existingNames.has(finalName));
        }

        return await fileRepository.create(finalName, size, mimeType, storageKey, folderId, userId);
    }

    async listFiles(folderId, userId) {
        if (folderId) {
            const folder = await folderRepository.findByIdAndUser(folderId, userId);
            if (!folder) {
                throw new AppError('Folder not found', 404);
            }
        }
        return await fileRepository.findByFolderAndUser(folderId, userId);
    }

    async getFile(id, userId) {
        const file = await fileRepository.findByIdAndUser(id, userId);
        if (!file) {
            throw new AppError('File not found', 404);
        }
        return file;
    }

    async getAccessibleFile(id, userId) {
        const file = await fileRepository.findAccessibleById(id, userId);
        if (!file) {
            throw new AppError('File not found', 404);
        }
        return file;
    }

    async updateFile(id, userId, originalName, folderId) {
        const file = await fileRepository.findByIdAndUser(id, userId);
        if (!file) {
            throw new AppError('File not found', 404);
        }

        // Uniqueness check if renaming or moving
        const targetFolderId = folderId !== undefined ? folderId : file.folder_id;
        const targetName = originalName || file.original_name;
        
        if (originalName || folderId !== undefined) {
            const existingFiles = await fileRepository.findByFolderAndUser(targetFolderId, userId);
            const isDuplicate = existingFiles.some(f => f.original_name === targetName && f.id !== id);
            if (isDuplicate) {
                throw new AppError('A file with this name already exists in the destination folder', 409);
            }
        }

        return await fileRepository.update(id, userId, originalName, folderId);
    }

    async deleteFile(id, userId) {
        const file = await fileRepository.findByIdAndUser(id, userId);
        if (!file) {
            throw new AppError('File not found', 404);
        }
        return await fileRepository.softDelete(id, userId);
    }

    async copyFile(id, userId, destinationFolderId = null) {
        // 1. Get the file (either owned or accessible via share)
        const file = await this.getAccessibleFile(id, userId);
        
        // 2. Generate a new storage key
        const newStorageKey = cosService.generateObjectKey(userId, file.original_name);
        
        // 3. Copy the object in COS
        await cosService.copyObject(file.storage_key, newStorageKey);
        
        // 4. Create the file record in the destination folder
        return await this.createFileRecord(
            file.original_name,
            file.size,
            file.mime_type,
            newStorageKey,
            destinationFolderId,
            userId
        );
    }
}

module.exports = new FileService();
