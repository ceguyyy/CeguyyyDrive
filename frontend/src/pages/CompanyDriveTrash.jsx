import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Box, Typography, CircularProgress, Alert, Button, Card, CardContent, Grid } from '@mui/material';
import { Delete as TrashIcon, Restore as RestoreIcon, Folder as FolderIcon, InsertDriveFile as FileIcon } from '@mui/icons-material';
import api from '../services/api';

export default function CompanyDriveTrash() {
    const { orgId } = useParams();
    const queryClient = useQueryClient();

    const { data: contents, isLoading, isError, error } = useQuery({
        queryKey: ['org-drive-trash', orgId],
        queryFn: async () => {
            const res = await api.get(`/organizations/${orgId}/drive/trash`);
            return res.data.data;
        }
    });

    const restoreMutation = useMutation({
        mutationFn: async ({ type, id }) => {
            const res = await api.post(`/organizations/${orgId}/drive/trash/${type}/${id}/restore`);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['org-drive-trash', orgId] });
            queryClient.invalidateQueries({ queryKey: ['org-drive', orgId] });
        }
    });

    if (isLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (isError) {
        return (
            <Alert severity="error" sx={{ m: 2 }}>
                {error?.response?.data?.message || 'Failed to load Company Drive trash'}
            </Alert>
        );
    }

    const { folders = [], files = [] } = contents || {};
    const totalCount = folders.length + files.length;

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                <TrashIcon sx={{ color: 'error.main', fontSize: 28 }} />
                <Typography variant="h5" fontWeight="bold">
                    Company Drive Trash
                </Typography>
            </Box>

            {totalCount === 0 ? (
                <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
                    <TrashIcon sx={{ fontSize: 64, color: '#D1D5DB', mb: 1 }} />
                    <Typography variant="h6">Trash is empty</Typography>
                </Box>
            ) : (
                <Grid container spacing={2}>
                    {folders.map(fol => (
                        <Grid item xs={12} sm={6} md={4} key={fol.id}>
                            <Card elevation={0} sx={{ border: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', p: 2 }}>
                                <FolderIcon sx={{ color: '#F59E0B', mr: 2, fontSize: 32 }} />
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography variant="subtitle2" noWrap fontWeight="bold">{fol.name}</Typography>
                                    <Typography variant="caption" color="text.secondary">Folder</Typography>
                                </Box>
                                <Button
                                    size="small"
                                    startIcon={<RestoreIcon />}
                                    onClick={() => restoreMutation.mutate({ type: 'folder', id: fol.id })}
                                >
                                    Restore
                                </Button>
                            </Card>
                        </Grid>
                    ))}
                    {files.map(file => (
                        <Grid item xs={12} sm={6} md={4} key={file.id}>
                            <Card elevation={0} sx={{ border: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', p: 2 }}>
                                <FileIcon sx={{ color: '#3B82F6', mr: 2, fontSize: 32 }} />
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography variant="subtitle2" noWrap fontWeight="bold">{file.original_name}</Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        File {file.uploader_name ? `• ${file.uploader_name}` : ''}
                                    </Typography>
                                </Box>
                                <Button
                                    size="small"
                                    startIcon={<RestoreIcon />}
                                    onClick={() => restoreMutation.mutate({ type: 'file', id: file.id })}
                                >
                                    Restore
                                </Button>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}
        </Box>
    );
}
