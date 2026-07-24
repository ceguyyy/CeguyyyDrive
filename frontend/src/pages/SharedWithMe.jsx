import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
    Box, Typography, CircularProgress, Alert, Card, 
    CardContent, Button, Stack, Avatar, Chip, Tabs, Tab 
} from '@mui/material';
import { 
    Group as SharedIcon, 
    InsertDriveFile as FileIcon, 
    Folder as FolderIcon,
    Download as DownloadIcon,
    Visibility as PreviewIcon,
    ContentCopy as CopyIcon,
    Delete as DeleteIcon,
    Send as SendIcon
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
    const [tab, setTab] = useState(0); // 0: Shared with me, 1: Shared by me
    const [previewFile, setPreviewFile] = useState(null);
    const [copyingId, setCopyingId] = useState(null);
    const queryClient = useQueryClient();

    // Query 1: Shared with me (Received)
    const { data: receivedData, isLoading: isReceivedLoading, error: receivedError } = useQuery({
        queryKey: ['shared-with-me'],
        queryFn: async () => {
            const res = await api.get('/shares/received');
            return res.data.data.shares;
        }
    });

    // Query 2: Shared by me (Sent)
    const { data: sentData, isLoading: isSentLoading, error: sentError } = useQuery({
        queryKey: ['shared-by-me'],
        queryFn: async () => {
            const res = await api.get('/shares/sent');
            return res.data.data.shares;
        }
    });

    // Mutation: Copy shared item to user's Drive
    const copyToDriveMutation = useMutation({
        mutationFn: async ({ isFile, id }) => {
            const endpoint = isFile ? `/files/${id}/copy` : `/folders/${id}/copy`;
            const res = await api.post(endpoint, { destinationFolderId: null });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['folders'] });
            alert('Item copied to your Drive root!');
        },
        onError: (err) => {
            alert(err.response?.data?.message || 'Failed to copy item to your Drive');
        }
    });

    // Mutation: Remove received share (Recipient side)
    const removeReceivedShareMutation = useMutation({
        mutationFn: async (shareId) => {
            await api.delete(`/shares/received/${shareId}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['shared-with-me'] });
        }
    });

    // Mutation: Revoke sent share (Sender side)
    const revokeSentShareMutation = useMutation({
        mutationFn: async (shareId) => {
            await api.delete(`/shares/${shareId}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['shared-by-me'] });
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

    const handleCopyToDrive = (share) => {
        const isFile = !!share.file_id;
        const targetId = isFile ? share.file_id : share.folder_id;
        setCopyingId(share.id);
        copyToDriveMutation.mutate({ isFile, id: targetId }, {
            onSettled: () => setCopyingId(null)
        });
    };

    const isLoading = tab === 0 ? isReceivedLoading : isSentLoading;
    const error = tab === 0 ? receivedError : sentError;
    const receivedShares = receivedData || [];
    const sentShares = sentData || [];

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Typography color="text.primary" sx={{ fontSize: '1.25rem', fontWeight: 700 }}>
                    Sharing Management
                </Typography>
            </Box>

            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: '1px solid #EAEAEA' }}>
                <Tab icon={<SharedIcon fontSize="small" />} iconPosition="start" label={`Shared with me (${receivedShares.length})`} />
                <Tab icon={<SendIcon fontSize="small" />} iconPosition="start" label={`Shared by me (${sentShares.length})`} />
            </Tabs>

            {isLoading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
                    <CircularProgress />
                </Box>
            )}

            {error && (
                <Alert severity="error" sx={{ m: 4 }}>
                    Failed to load shares: {error.message}
                </Alert>
            )}

            {!isLoading && !error && (
                <>
                    {/* TAB 0: SHARED WITH ME (RECEIVED) */}
                    {tab === 0 && (
                        receivedShares.length === 0 ? (
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
                                {receivedShares.map(share => {
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

                                                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
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

                                                    <Button 
                                                        variant="outlined" 
                                                        size="small"
                                                        color="primary"
                                                        startIcon={copyingId === share.id ? <CircularProgress size={16} /> : <CopyIcon />}
                                                        onClick={() => handleCopyToDrive(share)}
                                                        disabled={copyingId === share.id}
                                                    >
                                                        Copy to My Drive
                                                    </Button>

                                                    <Button 
                                                        variant="outlined" 
                                                        size="small"
                                                        color="error"
                                                        startIcon={<DeleteIcon />}
                                                        onClick={() => removeReceivedShareMutation.mutate(share.id)}
                                                    >
                                                        Remove
                                                    </Button>
                                                </Box>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </Stack>
                        )
                    )}

                    {/* TAB 1: SHARED BY ME (SENT) */}
                    {tab === 1 && (
                        sentShares.length === 0 ? (
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
                                <SendIcon sx={{ fontSize: 64, color: 'text.disabled' }} />
                                <Typography variant="h6" color="text.secondary">
                                    You haven't shared any items yet
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    When you share a file or folder by email, it will be listed here.
                                </Typography>
                            </Box>
                        ) : (
                            <Stack spacing={2} sx={{ flex: 1, overflowY: 'auto', pb: 4, minHeight: 0 }}>
                                {sentShares.map(share => {
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
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                                                        {share.recipient_email ? (
                                                            <Chip 
                                                                avatar={<Avatar>{share.recipient_name?.charAt(0)?.toUpperCase() || 'U'}</Avatar>} 
                                                                label={`Shared with ${share.recipient_name || share.recipient_email}`} 
                                                                size="small" 
                                                                color="primary"
                                                                variant="outlined" 
                                                            />
                                                        ) : (
                                                            <Chip label="Public Share Link" size="small" variant="outlined" />
                                                        )}
                                                        <Typography variant="caption" color="text.secondary">
                                                            • Shared on {new Date(share.created_at).toLocaleDateString()}
                                                        </Typography>
                                                    </Box>
                                                </Box>

                                                <Button 
                                                    variant="outlined" 
                                                    size="small"
                                                    color="error"
                                                    startIcon={<DeleteIcon />}
                                                    onClick={() => revokeSentShareMutation.mutate(share.id)}
                                                >
                                                    Revoke Access
                                                </Button>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </Stack>
                        )
                    )}
                </>
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
