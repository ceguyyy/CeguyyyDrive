import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
    Box, Typography, CircularProgress, Alert, Card, 
    CardContent, Button, Stack, Avatar, Chip 
} from '@mui/material';
import { 
    Group as SharedIcon, 
    InsertDriveFile as FileIcon, 
    Folder as FolderIcon,
    Download as DownloadIcon,
    Visibility as PreviewIcon
} from '@mui/icons-material';
import api from '../services/api';
import FilePreviewModal from '../components/modals/FilePreviewModal';

function formatBytes(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function SharedWithMe() {
    const [previewFile, setPreviewFile] = useState(null);

    const { data, isLoading, error } = useQuery({
        queryKey: ['shared-with-me'],
        queryFn: async () => {
            const res = await api.get('/shares/received');
            return res.data.data.shares;
        }
    });

    const handleDownload = async (file) => {
        try {
            const res = await api.get(`/storage/download-url/${file.file_id}`);
            const previewUrl = res.data.data.downloadUrl;
            
            const response = await fetch(previewUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = file.file_name || 'shared-file';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            alert('Failed to download file');
        }
    };

    if (isLoading) return (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
            <CircularProgress />
        </Box>
    );

    if (error) return (
        <Alert severity="error" sx={{ m: 4 }}>
            Failed to load shared items: {error.message}
        </Alert>
    );

    const shares = data || [];

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <Typography color="text.primary" sx={{ fontSize: '1.25rem', fontWeight: 700 }}>
                    Shared with me
                </Typography>
            </Box>

            {shares.length === 0 ? (
                <Box sx={{ 
                    flex: 1, 
                    border: '2px dashed #E0E0E0',
                    bgcolor: 'background.paper',
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'center', 
                    justifyContent: 'center',
                    gap: 2,
                    borderRadius: 2
                }}>
                    <SharedIcon sx={{ fontSize: 64, color: 'text.disabled' }} />
                    <Typography variant="h6" color="text.secondary">
                        No items have been shared with you yet
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        When someone shares a file or folder with your email, it will appear here.
                    </Typography>
                </Box>
            ) : (
                <Stack spacing={2} sx={{ flex: 1, overflowY: 'auto', pb: 4, minHeight: 0 }}>
                    {shares.map(share => {
                        const isFile = !!share.file_id;
                        const itemName = isFile ? share.file_name : share.folder_name;

                        return (
                            <Card key={share.id} variant="outlined" sx={{ flexShrink: 0 }}>
                                <CardContent sx={{ display: 'flex', alignItems: 'center', p: 2, '&:last-child': { pb: 2 } }}>
                                    {isFile ? (
                                        <FileIcon sx={{ color: 'primary.main', mr: 2, fontSize: 36 }} />
                                    ) : (
                                        <FolderIcon sx={{ color: 'warning.main', mr: 2, fontSize: 36 }} />
                                    )}

                                    <Box sx={{ flexGrow: 1, minWidth: 0, mr: 2 }}>
                                        <Typography variant="body1" fontWeight="600" noWrap>
                                            {itemName}
                                        </Typography>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                            <Chip 
                                                avatar={<Avatar>{share.owner_name?.charAt(0)?.toUpperCase()}</Avatar>} 
                                                label={`Shared by ${share.owner_name}`} 
                                                size="small" 
                                                variant="outlined" 
                                            />
                                            {isFile && (
                                                <Typography variant="caption" color="text.secondary">
                                                    {formatBytes(share.size)}
                                                </Typography>
                                            )}
                                            <Typography variant="caption" color="text.secondary">
                                                • {new Date(share.created_at).toLocaleDateString()}
                                            </Typography>
                                        </Box>
                                    </Box>

                                    <Box sx={{ display: 'flex', gap: 1 }}>
                                        {isFile && (
                                            <>
                                                <Button 
                                                    variant="outlined" 
                                                    size="small"
                                                    startIcon={<PreviewIcon />}
                                                    onClick={() => setPreviewFile({
                                                        id: share.file_id,
                                                        original_name: share.file_name,
                                                        mime_type: share.mime_type,
                                                        size: share.size
                                                    })}
                                                >
                                                    Preview
                                                </Button>
                                                <Button 
                                                    variant="contained" 
                                                    size="small"
                                                    startIcon={<DownloadIcon />}
                                                    onClick={() => handleDownload(share)}
                                                >
                                                    Download
                                                </Button>
                                            </>
                                        )}
                                    </Box>
                                </CardContent>
                            </Card>
                        );
                    })}
                </Stack>
            )}

            {previewFile && (
                <FilePreviewModal
                    isOpen={!!previewFile}
                    onClose={() => setPreviewFile(null)}
                    file={previewFile}
                />
            )}
        </Box>
    );
}
