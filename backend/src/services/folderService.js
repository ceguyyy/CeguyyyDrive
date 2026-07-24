const folderRepository = require('../repositories/folderRepository');
const fileRepository = require('../repositories/fileRepository');
const AppError = require('../utils/AppError');

class FolderService {
    async createFolder(name, parentId, userId) {
        // Validate parentId if provided
        if (parentId) {
            const parent = await folderRepository.findByIdAndUser(parentId, userId);
            if (!parent) {
                throw new AppError('Parent folder not found', 404);
            }
        }

        // Check for duplicate name in the same directory
        const existing = await folderRepository.findByNameAndParent(name, parentId, userId);
        if (existing) {
            throw new AppError('A folder with this name already exists in this location', 400);
        }

        return await folderRepository.create(name, parentId, userId);
    }

    async listFolders(parentId, userId) {
        if (parentId) {
            const parent = await folderRepository.findByIdAndUser(parentId, userId);
            if (!parent) {
                throw new AppError('Parent folder not found', 404);
            }
        }
        return await folderRepository.findByParentAndUser(parentId, userId);
    }

    async getFolder(id, userId) {
        const folder = await folderRepository.findByIdAndUser(id, userId);
        if (!folder) {
            throw new AppError('Folder not found', 404);
        }
        return folder;
    }

    async getAncestors(folderId, userId) {
        const ancestors = [];
        let currentId = folderId;
        while (currentId) {
            const folder = await folderRepository.findByIdAndUser(currentId, userId);
            if (!folder || !folder.parent_id) break;
            const parentFolder = await folderRepository.findByIdAndUser(folder.parent_id, userId);
            if (!parentFolder) break;
            ancestors.unshift({ id: parentFolder.id, name: parentFolder.name });
            currentId = parentFolder.id;
        }
        return ancestors;
    }

    async updateFolder(id, name, parentId, userId) {
        const folder = await folderRepository.findByIdAndUser(id, userId);
        if (!folder) {
            throw new AppError('Folder not found', 404);
        }

        // Prevent moving folder into itself
        if (parentId === id) {
            throw new AppError('Cannot move a folder into itself', 400);
        }

        // Check name collision
        const targetParentId = parentId !== undefined ? parentId : folder.parent_id;
        const targetName = name || folder.name;

        if (targetName !== folder.name || targetParentId !== folder.parent_id) {
            const existing = await folderRepository.findByNameAndParent(targetName, targetParentId, userId);
            if (existing && existing.id !== id) {
                throw new AppError('A folder with this name already exists in the destination', 400);
            }
        }

        return await folderRepository.update(id, name, parentId, userId);
    }

    async deleteFolder(id, userId) {
        const folder = await folderRepository.findByIdAndUser(id, userId);
        if (!folder) {
            throw new AppError('Folder not found', 404);
        }
        // Soft delete the folder
        return await folderRepository.softDelete(id, userId);
    }

    async copyFolder(id, userId, destinationFolderId = null) {
        // Prevent copying into itself or its children
        if (destinationFolderId) {
            let currentParent = destinationFolderId;
            while (currentParent) {
                if (currentParent === id) {
                    throw new AppError('Cannot copy a folder into itself or its subfolders', 400);
                }
                const parentFolder = await folderRepository.findByIdAndUser(currentParent, userId);
                if (!parentFolder) break;
                currentParent = parentFolder.parent_id;
            }
        }

        const originalFolder = await this.getFolder(id, userId);

        // Auto-rename if duplicate in destination
        let finalName = originalFolder.name;
        const existingFolders = await folderRepository.findByParentAndUser(destinationFolderId, userId);
        const existingNames = new Set(existingFolders.map(f => f.name));
        if (existingNames.has(finalName)) {
            let counter = 1;
            do {
                finalName = `${originalFolder.name} (${counter})`;
                counter++;
            } while (existingNames.has(finalName));
        }

        const newFolder = await folderRepository.create(finalName, destinationFolderId, userId);

        // Copy files
        const fileService = require('./fileService');
        const filesInFolder = await fileRepository.findByFolderAndUser(id, userId);
        for (const file of filesInFolder) {
            await fileService.copyFile(file.id, userId, newFolder.id);
        }

        // Copy subfolders recursively
        const subfolders = await folderRepository.findByParentAndUser(id, userId);
        for (const subfolder of subfolders) {
            await this.copyFolder(subfolder.id, userId, newFolder.id);
        }

        return newFolder;
    }
}

module.exports = new FolderService();
