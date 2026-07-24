import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

export function useOrgItemActions(orgId, folderId = null) {
    const queryClient = useQueryClient();
    const queryKey = ['org-drive', orgId, folderId || 'root'];

    const renameFolder = useMutation({
        mutationFn: async ({ id, newName }) => {
            const res = await api.put(`/organizations/${orgId}/drive/folders/${id}`, { name: newName });
            return res.data;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['org-drive', orgId] })
    });

    const renameFile = useMutation({
        mutationFn: async ({ id, newName }) => {
            const res = await api.put(`/organizations/${orgId}/drive/files/${id}`, { name: newName });
            return res.data;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['org-drive', orgId] })
    });

    const deleteFolder = useMutation({
        mutationFn: async (id) => {
            await api.delete(`/organizations/${orgId}/drive/folders/${id}`);
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['org-drive', orgId] })
    });

    const deleteFile = useMutation({
        mutationFn: async (id) => {
            await api.delete(`/organizations/${orgId}/drive/files/${id}`);
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['org-drive', orgId] })
    });

    return { renameFolder, renameFile, deleteFolder, deleteFile };
}
