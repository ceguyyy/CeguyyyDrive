import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

export function useTrashActions() {
    const queryClient = useQueryClient();

    const restoreItem = useMutation({
        mutationFn: async ({ type, id }) => {
            const res = await api.post('/trash/restore', { type, id });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['trash'] });
            queryClient.invalidateQueries({ queryKey: ['folders'] });
        }
    });

    const emptyTrash = useMutation({
        mutationFn: async () => {
            await api.delete('/trash/empty');
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trash'] })
    });

    return { restoreItem, emptyTrash };
}
