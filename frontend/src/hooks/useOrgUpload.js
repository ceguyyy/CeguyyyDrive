import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import api from '../services/api';

export function useOrgUpload(orgId, folderId) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (file) => {
            if (!folderId) {
                throw new Error('Please open a role folder before uploading files');
            }

            // 1. Get presigned URL from backend
            const res = await api.post(`/organizations/${orgId}/drive/upload-url`, {
                name: file.name,
                size: file.size,
                mimeType: file.type || 'application/octet-stream',
                folderId
            });

            const { uploadUrl } = res.data.data;

            // 2. Upload file directly to COS via presigned URL
            await axios.put(uploadUrl, file, {
                headers: {
                    'Content-Type': file.type || 'application/octet-stream'
                }
            });

            return res.data.data.file;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['org-drive', orgId] });
        }
    });
}
