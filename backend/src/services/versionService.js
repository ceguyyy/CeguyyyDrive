const versionRepository = require('../repositories/versionRepository');
const fileRepository = require('../repositories/fileRepository');
const cosService = require('./cosService');
const AppError = require('../utils/AppError');

class VersionService {
    async registerNewVersion(fileId, userId, newStorageKey, newSize) {
        const file = await fileRepository.findByIdAndUser(fileId, userId);
        if (!file) throw new AppError('File not found', 404);

        // Snapshot the current version into file_versions
        await versionRepository.create(fileId, file.storage_key, file.size);

        // Update the main file record with the new version
        return await fileRepository.updateStorageDetails(fileId, userId, newStorageKey, newSize);
    }

    async getVersions(fileId, userId) {
        const file = await fileRepository.findByIdAndUser(fileId, userId);
        if (!file) throw new AppError('File not found', 404);

        return await versionRepository.findByFileId(fileId);
    }

    async restoreVersion(versionId, userId) {
        const version = await versionRepository.findById(versionId);
        if (!version) throw new AppError('Version not found', 404);

        const file = await fileRepository.findByIdAndUser(version.file_id, userId);
        if (!file) throw new AppError('File not found', 404);

        // We snapshot the CURRENT file state into file_versions 
        // so that the previous state before restoring is not lost!
        await versionRepository.create(file.id, file.storage_key, file.size);

        // Update the main file record with the restored version
        const restoredFile = await fileRepository.updateStorageDetails(file.id, userId, version.storage_key, version.size);
        
        // Remove the old version record since it's now the active one
        await versionRepository.delete(versionId);

        return restoredFile;
    }

    async deleteVersion(versionId, userId) {
        const version = await versionRepository.findById(versionId);
        if (!version) throw new AppError('Version not found', 404);

        // Verify the user owns the parent file
        const file = await fileRepository.findByIdAndUser(version.file_id, userId);
        if (!file) throw new AppError('File not found', 404);

        // 1. Physically delete from COS
        await cosService.deleteObject(version.storage_key);

        // 2. Remove from database
        await versionRepository.delete(versionId);
        return true;
    }

    async getDownloadUrl(versionId, userId) {
        const version = await versionRepository.findById(versionId);
        if (!version) throw new AppError('Version not found', 404);

        // Verify the user owns the parent file
        const file = await fileRepository.findByIdAndUser(version.file_id, userId);
        if (!file) throw new AppError('File not found', 404);

        const downloadUrl = await cosService.getPresignedDownloadUrl(version.storage_key);
        return downloadUrl;
    }
}

module.exports = new VersionService();
