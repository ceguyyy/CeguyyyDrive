import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

export function useItemActions(folderId = null) {
    const queryClient = useQueryClient();
    const queryKey = ['folders', folderId ? folderId : 'root'];

    const renameFolder = useMutation({
        mutationFn: async ({ id, newName }) => {
            const res = await api.put(`/folders/${id}`, { name: newName });
            return res.data;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey })
    });

    const renameFile = useMutation({
        mutationFn: async ({ id, newName }) => {
            const res = await api.put(`/files/${id}`, { name: newName });
            return res.data;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey })
    });

    const deleteFolder = useMutation({
        mutationFn: async (id) => {
            await api.delete(`/folders/${id}`);
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey })
    });

    const deleteFile = useMutation({
        mutationFn: async (id) => {
            await api.delete(`/files/${id}`);
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey })
    });

    const shareFile = useMutation({
        mutationFn: async (id) => {
            const res = await api.post('/shares', { fileId: id });
            return res.data.data.share.token;
        },
        onSuccess: (token) => {
            const url = `${window.location.origin}/s/${token}`;
            navigator.clipboard.writeText(url);
            alert(`Link copied to clipboard!\n\n${url}`);
        }
    });

    const bulkDelete = useMutation({
        mutationFn: async ({ folderIds = [], fileIds = [] }) => {
            const promises = [
                ...folderIds.map(id => api.delete(`/folders/${id}`)),
                ...fileIds.map(id => api.delete(`/files/${id}`))
            ];
            await Promise.all(promises);
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey })
    });

    const moveFile = useMutation({
        mutationFn: async ({ id, targetFolderId }) => {
            const res = await api.put(`/files/${id}`, { folderId: targetFolderId });
            return res.data;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['folders'] }) // Invalidate all folders to refresh source and target
    });

    const moveFolder = useMutation({
        mutationFn: async ({ id, targetFolderId }) => {
            const res = await api.put(`/folders/${id}`, { parentId: targetFolderId });
            return res.data;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['folders'] })
    });

    const copyFile = useMutation({
        mutationFn: async ({ id, targetFolderId }) => {
            const res = await api.post(`/files/${id}/copy`, { destinationFolderId: targetFolderId });
            return res.data;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['folders'] })
    });

    const copyFolder = useMutation({
        mutationFn: async ({ id, targetFolderId }) => {
            const res = await api.post(`/folders/${id}/copy`, { destinationFolderId: targetFolderId });
            return res.data;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['folders'] })
    });

    return { renameFolder, renameFile, deleteFolder, deleteFile, shareFile, bulkDelete, moveFile, moveFolder, copyFile, copyFolder };
}
