import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
    InsertDriveFile as DocumentIcon, 
    Folder as FolderIcon,
    Error as ErrorIcon,
    Download as DownloadIcon,
    Visibility as PreviewIcon,
    ContentCopy as CopyIcon,
    ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import { 
    Box, Typography, Button, CircularProgress, Card, CardContent, Container, Stack, Alert 
} from '@mui/material';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import FilePreviewModal from '../components/modals/FilePreviewModal';

function formatBytes(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function PublicShare() {
    const { token } = useParams();
    const navigate = useNavigate();
    const { token: authToken } = useAuthStore();
    const [previewFile, setPreviewFile] = useState(null);
    const [copySuccess, setCopySuccess] = useState('');
    const [copyError, setCopyError] = useState('');
    const queryClient = useQueryClient();

    const { data, isLoading, error } = useQuery({
        queryKey: ['public-share', token],
        queryFn: async () => {
            const res = await api.get(`/shares/public/${token}`);
            return res.data.data;
        }
    });

    const copyToDriveMutation = useMutation({
        mutationFn: async ({ type, id }) => {
            const endpoint = type === 'file' ? `/files/${id}/copy` : `/folders/${id}/copy`;
            const res = await api.post(endpoint, { destinationFolderId: null });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['folders'] });
            setCopySuccess('Item copied successfully to your My Drive root!');
            setTimeout(() => setCopySuccess(''), 4000);
        },
        onError: (err) => {
            setCopyError(err.response?.data?.message || 'Failed to copy item to your Drive');
            setTimeout(() => setCopyError(''), 4000);
        }
    });

    if (isLoading) return (
        <Box sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress />
        </Box>
    );
    
    if (error) return (
        <Container component="main" maxWidth="sm" sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Card elevation={3} sx={{ width: '100%', textAlign: 'center', p: 4, borderRadius: 3 }}>
                <ErrorIcon sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
                <Typography variant="h5" fontWeight="bold" color="error" gutterBottom>
                    Link Invalid or Expired
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                    {error.response?.data?.message || 'This share link is no longer active or has expired.'}
                </Typography>
                <Button variant="outlined" onClick={() => navigate('/drive')}>
                    Go to My Drive
                </Button>
            </Card>
        </Container>
    );

    const isFile = data?.type === 'file';
    const item = isFile ? data.file : data.folder;
    const downloadUrl = data?.downloadUrl;

    const handleCopyToDrive = () => {
        if (!authToken) {
            navigate('/login');
            return;
        }
        copyToDriveMutation.mutate({ type: data.type, id: item.id });
    };

    return (
        <Container component="main" maxWidth="sm" sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }}>
            <Card elevation={3} sx={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', p: 4, borderRadius: 3 }}>
                {authToken && (
                    <Box sx={{ width: '100%', display: 'flex', justifyContent: 'flex-start', mb: 2 }}>
                        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/drive')}>
                            Back to My Drive
                        </Button>
                    </Box>
                )}

                <Box sx={{ 
                    width: 100, height: 100, borderRadius: '50%', 
                    bgcolor: isFile ? 'primary.light' : 'warning.light', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 3 
                }}>
                    {isFile ? (
                        <DocumentIcon sx={{ fontSize: 56, color: 'primary.main' }} />
                    ) : (
                        <FolderIcon sx={{ fontSize: 56, color: 'warning.main' }} />
                    )}
                </Box>
                
                <Box sx={{ width: '100%', textAlign: 'center', mb: 3 }}>
                    <Typography variant="h5" fontWeight="bold" noWrap title={item.name}>
                        {item.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        Publicly Shared {isFile ? `File (${formatBytes(item.size)})` : 'Folder'}
                    </Typography>
                </Box>

                {copySuccess && <Alert severity="success" sx={{ width: '100%', mb: 2 }}>{copySuccess}</Alert>}
                {copyError && <Alert severity="error" sx={{ width: '100%', mb: 2 }}>{copyError}</Alert>}

                <Stack spacing={2} sx={{ width: '100%' }}>
                    {isFile && downloadUrl && (
                        <>
                            <Button 
                                variant="outlined"
                                color="primary"
                                size="large"
                                startIcon={<PreviewIcon />}
                                onClick={() => setPreviewFile({
                                    id: item.id,
                                    original_name: item.name,
                                    mime_type: item.mime_type,
                                    size: item.size
                                })}
                                sx={{ py: 1.5, fontWeight: 'bold' }}
                            >
                                Preview File
                            </Button>

                            <Button 
                                href={downloadUrl} 
                                target="_blank" 
                                rel="noreferrer"
                                variant="contained"
                                color="primary"
                                size="large"
                                startIcon={<DownloadIcon />}
                                sx={{ py: 1.5, fontWeight: 'bold' }}
                            >
                                Download File
                            </Button>
                        </>
                    )}

                    <Button 
                        variant={isFile ? "outlined" : "contained"}
                        color="secondary"
                        size="large"
                        startIcon={copyToDriveMutation.isPending ? <CircularProgress size={20} color="inherit" /> : <CopyIcon />}
                        onClick={handleCopyToDrive}
                        disabled={copyToDriveMutation.isPending}
                        sx={{ py: 1.5, fontWeight: 'bold' }}
                    >
                        {copyToDriveMutation.isPending 
                            ? 'Copying to Drive...' 
                            : authToken 
                                ? 'Copy to My Drive' 
                                : 'Log in to Save to My Drive'}
                    </Button>
                </Stack>

                {previewFile && (
                    <FilePreviewModal
                        isOpen={!!previewFile}
                        onClose={() => setPreviewFile(null)}
                        file={previewFile}
                    />
                )}
            </Card>
        </Container>
    );
}
