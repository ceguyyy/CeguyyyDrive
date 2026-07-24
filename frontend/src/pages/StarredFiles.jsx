import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';
import { Star as StarIcon } from '@mui/icons-material';
import api from '../services/api';
import FileGrid from '../features/files/FileGrid';
import FileCard from '../features/files/FileCard';

export default function StarredFiles() {
    const { data: files = [], isLoading, isError, error } = useQuery({
        queryKey: ['starred-files'],
        queryFn: async () => {
            const res = await api.get('/files/starred');
            return res.data.data.files;
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
                {error?.response?.data?.message || 'Failed to load starred files'}
            </Alert>
        );
    }

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                <StarIcon sx={{ color: '#F59E0B', fontSize: 28 }} />
                <Typography variant="h5" fontWeight="bold">
                    Starred Files
                </Typography>
            </Box>

            {files.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
                    <StarIcon sx={{ fontSize: 64, color: '#D1D5DB', mb: 1 }} />
                    <Typography variant="h6">No starred files yet</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Click the star icon on any file in My Drive to add it to your starred files.
                    </Typography>
                </Box>
            ) : (
                <FileGrid>
                    {files.map(file => (
                        <FileCard key={file.id} file={file} />
                    ))}
                </FileGrid>
            )}
        </Box>
    );
}
