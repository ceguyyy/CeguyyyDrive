import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import api from '../services/api';
import { useUploadStore } from '../store/uploadStore';

const folderCache = {}; // In-memory cache for folder paths during bulk upload

async function getOrCreateFolderStructure(relativePath, baseFolderId) {
    if (!relativePath) return baseFolderId === 'root' ? null : baseFolderId;
    
    const parts = relativePath.split('/');
    parts.pop(); // Remove the file name itself
    
    if (parts.length === 0) return baseFolderId === 'root' ? null : baseFolderId;
    
    let currentParent = baseFolderId;
    let currentPath = '';

    for (const part of parts) {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        const cacheKey = `${baseFolderId}_${currentPath}`;
        
        if (folderCache[cacheKey]) {
            currentParent = folderCache[cacheKey];
            continue;
        }

        try {
            // 1. Fetch current subfolders to see if it exists
            const res = await api.get(`/folders/${currentParent}`);
            const subfolders = res.data.data.subfolders;
            const existing = subfolders.find(f => f.name === part);
            
            if (existing) {
                currentParent = existing.id;
                folderCache[cacheKey] = currentParent;
            } else {
                // 2. Create if not exists
                const createRes = await api.post('/folders', { 
                    name: part, 
                    parentId: currentParent === 'root' ? null : currentParent 
                });
                currentParent = createRes.data.data.folder.id;
                folderCache[cacheKey] = currentParent;
            }
        } catch (err) {
            console.error("Failed to ensure folder structure", err);
            // Fallback to base folder if something goes wrong
            return baseFolderId === 'root' ? null : baseFolderId;
        }
    }
    
    return currentParent === 'root' ? null : currentParent;
}

export function useUpload(folderId = null) {
    const queryClient = useQueryClient();
    const { addUpload, updateProgress, setStatus } = useUploadStore();

    return useMutation({
        mutationFn: async (file) => {
            const uploadId = Math.random().toString(36).substring(7);
            // Display path if available so user sees 'Folder/File.txt'
            const displayName = file.webkitRelativePath || file.name;
            addUpload(uploadId, displayName);

            let createdFileId = null;
            try {
                // Determine target folder ID dynamically based on relative path
                const targetFolderId = await getOrCreateFolderStructure(file.webkitRelativePath, folderId);

                // 1. Get Pre-Signed URL and create file record
                const { data: { data } } = await api.post('/storage/upload-url', {
                    fileName: file.name,
                    size: file.size,
                    mimeType: file.type || 'application/octet-stream',
                    folderId: targetFolderId
                });

                const { uploadUrl, fileId, storageKey } = data;
                createdFileId = fileId; // save for rollback

                // 2. Upload directly to Tencent COS
                await axios.put(uploadUrl, file, {
                    headers: {
                        'Content-Type': file.type || 'application/octet-stream'
                    },
                    onUploadProgress: (progressEvent) => {
                        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                        updateProgress(uploadId, percentCompleted);
                    }
                });

                // 3. Complete
                setStatus(uploadId, 'success');
                queryClient.invalidateQueries({ queryKey: ['folders', folderId ? folderId : 'root'] });
                
                return { fileId, storageKey };
            } catch (err) {
                console.error("Upload failed:", err);
                setStatus(uploadId, 'error');
                
                // Rollback if the file was created in DB but failed to upload to COS
                if (createdFileId) {
                    try {
                        await api.delete(`/files/${createdFileId}`);
                        queryClient.invalidateQueries({ queryKey: ['folders', folderId ? folderId : 'root'] });
                    } catch (rollbackErr) {
                        console.error("Failed to rollback ghost file", rollbackErr);
                    }
                }
                
                const errorMsg = err.response?.data?.message || err.message || 'Unknown error';
                alert(`Failed to upload ${file.name}:\n${errorMsg}\n\nIf you see "Network Error", please ensure CORS is enabled on your Tencent COS bucket.`);
                
                throw err;
            }
        }
    });
}
