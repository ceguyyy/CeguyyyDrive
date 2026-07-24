import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
    Box, Typography, CircularProgress, Alert, Card, 
    CardContent, Button, Stack, Avatar, Chip, Tabs, Tab,
    IconButton, Menu, MenuItem, ListItemIcon, ListItemText, Tooltip
} from '@mui/material';
import { 
    Group as SharedIcon, 
    InsertDriveFile as FileIcon, 
    Folder as FolderIcon,
    Download as DownloadIcon,
    Visibility as PreviewIcon,
    ContentCopy as CopyIcon,
    Delete as DeleteIcon,
    Send as SendIcon,
    MoreVert as MoreVertIcon,
    Refresh as RefreshIcon,
    AccessTime as TimeIcon
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

function SharedCardActionsMenu({ onPreview, onDownload, onCopyToDrive, onCopyLink, onDelete, deleteText = 'Remove', isFile = false }) {
    const [anchorEl, setAnchorEl] = useState(null);
    const open = Boolean(anchorEl);

    const handleClick = (e) => {
        e.stopPropagation();
        setAnchorEl(e.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    return (
        <>
            <IconButton size="small" onClick={handleClick} aria-label="actions menu">
                <MoreVertIcon />
            </IconButton>
            <Menu anchorEl={anchorEl} open={open} onClose={handleClose} onClick={(e) => e.stopPropagation()}>
                {isFile && onPreview && (
                    <MenuItem onClick={() => { handleClose(); onPreview(); }}>
                        <ListItemIcon><PreviewIcon fontSize="small" /></ListItemIcon>
                        <ListItemText>Preview</ListItemText>
                    </MenuItem>
                )}
                {isFile && onDownload && (
                    <MenuItem onClick={() => { handleClose(); onDownload(); }}>
                        <ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon>
                        <ListItemText>Download</ListItemText>
                    </MenuItem>
                )}
                {onCopyToDrive && (
                    <MenuItem onClick={() => { handleClose(); onCopyToDrive(); }}>
                        <ListItemIcon><CopyIcon fontSize="small" /></ListItemIcon>
                        <ListItemText>Copy to My Drive</ListItemText>
                    </MenuItem>
                )}
                {onCopyLink && (
                    <MenuItem onClick={() => { handleClose(); onCopyLink(); }}>
                        <ListItemIcon><CopyIcon fontSize="small" /></ListItemIcon>
                        <ListItemText>Copy Link</ListItemText>
                    </MenuItem>
                )}
                {onDelete && (
                    <MenuItem onClick={() => { handleClose(); onDelete(); }} sx={{ color: 'error.main' }}>
                        <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
                        <ListItemText>{deleteText}</ListItemText>
                    </MenuItem>
                )}
            </Menu>
        </>
    );
}

export default function SharedWithMe() {
    const [tab, setTab] = useState(0); // 0: Shared with me, 1: Shared by me
    const [previewFile, setPreviewFile] = useState(null);
    const [copyingId, setCopyingId] = useState(null);
    const [copiedShareId, setCopiedShareId] = useState(null);
    const queryClient = useQueryClient();

    // Query 1: Shared with me (Received)
    const { data: receivedData, isLoading: isReceivedLoading, error: receivedError, refetch: refetchReceived, isRefetching: isReceivedRefetching } = useQuery({
        queryKey: ['shared-with-me'],
        queryFn: async () => {
            const res = await api.get('/shares/received');
            return res.data.data.shares;
        }
    });

    // Query 2: Shared by me (Sent)
    const { data: sentData, isLoading: isSentLoading, error: sentError, refetch: refetchSent, isRefetching: isSentRefetching } = useQuery({
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

    const handleCopyShareLink = (share) => {
        const token = share.token || share.id;
        const link = `${window.location.origin}/s/${token}`;
        navigator.clipboard.writeText(link);
        setCopiedShareId(share.id);
        setTimeout(() => setCopiedShareId(null), 3000);
    };

    const isLoading = tab === 0 ? isReceivedLoading : isSentLoading;
    const isRefetching = tab === 0 ? isReceivedRefetching : isSentRefetching;
    const error = tab === 0 ? receivedError : sentError;
    const receivedShares = receivedData || [];
    const sentShares = sentData || [];

    const handleRefresh = () => {
        if (tab === 0) refetchReceived();
        else refetchSent();
    };

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography color="text.primary" sx={{ fontSize: '1.25rem', fontWeight: 700 }}>
                        Sharing Management
                    </Typography>
                    <Tooltip title="Refresh">
                        <IconButton 
                            size="small" 
                            onClick={handleRefresh} 
                            disabled={isRefetching}
                            sx={{ color: 'text.secondary' }}
                        >
                            <RefreshIcon fontSize="small" sx={{ transform: isRefetching ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }} />
                        </IconButton>
                    </Tooltip>
                </Box>
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

                                                {/* Desktop Quick Action Buttons */}
                                                <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 1 }}>
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

                                                {/* Always Available / Mobile 3-Dot Menu */}
                                                <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                                                    <SharedCardActionsMenu 
                                                        isFile={isFile}
                                                        onPreview={isFile ? () => setPreviewFile({
                                                            id: share.file_id,
                                                            original_name: share.file_name,
                                                            mime_type: share.mime_type,
                                                            size: share.size
                                                        }) : null}
                                                        onDownload={isFile ? () => handleDownload(share) : null}
                                                        onCopyToDrive={() => handleCopyToDrive(share)}
                                                        onDelete={() => removeReceivedShareMutation.mutate(share.id)}
                                                        deleteText="Remove"
                                                    />
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
                                    When you share a file or folder, it will be listed here.
                                </Typography>
                            </Box>
                        ) : (
                            <Stack spacing={2} sx={{ flex: 1, overflowY: 'auto', pb: 4, minHeight: 0 }}>
                                {sentShares.map(share => {
                                    const isFile = !!share.file_id;
                                    const itemName = isFile ? share.file_name : share.folder_name;
                                    const isExpired = share.expires_at && new Date() > new Date(share.expires_at);

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

                                                        {share.expires_at && (
                                                            <Chip 
                                                                icon={<TimeIcon fontSize="small" />}
                                                                label={isExpired ? "Expired" : `Expires ${new Date(share.expires_at).toLocaleDateString()}`}
                                                                size="small"
                                                                color={isExpired ? "error" : "warning"}
                                                                variant="outlined"
                                                            />
                                                        )}

                                                        <Typography variant="caption" color="text.secondary">
                                                            • Shared on {new Date(share.created_at).toLocaleDateString()}
                                                        </Typography>
                                                    </Box>
                                                </Box>

                                                {/* Desktop Action Buttons */}
                                                <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 1 }}>
                                                    <Button 
                                                        variant="outlined" 
                                                        size="small"
                                                        color={copiedShareId === share.id ? "success" : "primary"}
                                                        startIcon={<CopyIcon />}
                                                        onClick={() => handleCopyShareLink(share)}
                                                    >
                                                        {copiedShareId === share.id ? 'Copied!' : 'Copy Link'}
                                                    </Button>

                                                    <Button 
                                                        variant="outlined" 
                                                        size="small"
                                                        color="error"
                                                        startIcon={<DeleteIcon />}
                                                        onClick={() => revokeSentShareMutation.mutate(share.id)}
                                                    >
                                                        Revoke Access
                                                    </Button>
                                                </Box>

                                                {/* Mobile 3-Dot Menu */}
                                                <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                                                    <SharedCardActionsMenu 
                                                        isFile={false}
                                                        onCopyLink={() => handleCopyShareLink(share)}
                                                        onDelete={() => revokeSentShareMutation.mutate(share.id)}
                                                        deleteText="Revoke Access"
                                                    />
                                                </Box>
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
