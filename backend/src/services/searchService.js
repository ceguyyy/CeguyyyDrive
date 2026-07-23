const searchRepository = require('../repositories/searchRepository');

class SearchService {
    async performSearch(query, mimeType, userId) {
        // Run file and folder searches concurrently
        const [files, folders] = await Promise.all([
            searchRepository.searchFiles(query, mimeType, userId),
            // Only search folders if mimeType is not provided (since folders don't have mime types)
            mimeType ? Promise.resolve([]) : searchRepository.searchFolders(query, userId)
        ]);

        return {
            files,
            folders
        };
    }
}

module.exports = new SearchService();
