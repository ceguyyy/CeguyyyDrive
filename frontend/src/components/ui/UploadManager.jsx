import React from 'react';
import { CheckCircle as CheckCircleIcon, Error as ErrorIcon } from '@mui/icons-material';
import { useUploadStore } from '../../store/uploadStore';
import { Box, Card, CardContent, Typography, LinearProgress, IconButton, Stack } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

export default function UploadManager() {
    const { uploads, removeUpload } = useUploadStore();
    const uploadList = Object.entries(uploads).filter(([, u]) => u.status === 'uploading');

    if (uploadList.length === 0) return null;

    return (
        <Box sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1300, width: 320 }}>
            <Stack spacing={2}>
                {uploadList.map(([id, upload]) => (
                    <Card key={id} elevation={4}>
                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: upload.status === 'uploading' ? 1 : 0 }}>
                                <Typography variant="body2" fontWeight="bold" noWrap sx={{ pr: 2, flexGrow: 1 }}>
                                    {upload.name}
                                </Typography>
                                
                                {upload.status === 'success' && <CheckCircleIcon color="success" />}
                                {upload.status === 'error' && <ErrorIcon color="error" />}
                                {upload.status === 'uploading' && (
                                    <Typography variant="caption" fontWeight="bold">
                                        {upload.progress}%
                                    </Typography>
                                )}
                            </Box>
                            
                            {upload.status === 'uploading' && (
                                <LinearProgress variant="determinate" value={upload.progress} />
                            )}
                        </CardContent>
                    </Card>
                ))}
            </Stack>
        </Box>
    );
}
