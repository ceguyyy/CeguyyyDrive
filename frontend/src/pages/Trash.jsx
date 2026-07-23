import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
    Restore as RestoreIcon, 
    Warning as WarningIcon, 
    Folder as FolderIcon, 
    InsertDriveFile as DocumentIcon 
} from '@mui/icons-material';
import api from '../services/api';
import { useTrashActions } from '../hooks/useTrashActions';
import { 
    Box, Typography, Button, CircularProgress, Alert, 
    Card, CardContent, IconButton, Tooltip, Stack 
} from '@mui/material';
import ConfirmModal from '../components/modals/ConfirmModal';

export default function Trash() {
    const [isConfirmOpen, setIsConfirmOpen] = React.useState(false);
    const { data, isLoading, error } = useQuery({
        queryKey: ['trash'],
        queryFn: async () => {
            const res = await api.get('/trash');
            return res.data.data;
        }
    });
    
    const { restoreItem, emptyTrash } = useTrashActions();

    if (isLoading) return (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
            <CircularProgress />
        </Box>
    );

    if (error) return (
        <Alert severity="error" sx={{ m: 4 }}>
            Failed to load trash
        </Alert>
    );

    const files = data?.files || [];
    const folders = data?.folders || [];
    const totalItems = files.length + folders.length;

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Typography variant="h4" fontWeight="bold">
                    Trash Bin
                </Typography>
                <Button 
                    variant="contained" 
                    color="error"
                    onClick={() => setIsConfirmOpen(true)}
                    disabled={totalItems === 0 || emptyTrash.isPending}
                >
                    {emptyTrash.isPending ? 'Emptying...' : 'Empty Trash'}
                </Button>
            </Box>
            
            {totalItems === 0 ? (
                <Box sx={{ 
                    flex: 1, 
                    border: '2px dashed text.secondary',
                    bgcolor: 'background.paper',
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'center', 
                    justifyContent: 'center',
                    gap: 2,
                    borderRadius: 2
                }}>
                    <WarningIcon sx={{ fontSize: 64, color: 'text.disabled' }} />
                    <Typography variant="h6" color="text.secondary">
                        Trash is empty
                    </Typography>
                </Box>
            ) : (
                <Stack spacing={2} sx={{ flex: 1, overflowY: 'auto', pb: 4, minHeight: 0 }}>
                    {folders.map(folder => (
                        <Card key={folder.id} variant="outlined" sx={{ flexShrink: 0 }}>
                            <CardContent sx={{ display: 'flex', alignItems: 'center', p: 2, '&:last-child': { pb: 2 } }}>
                                <FolderIcon sx={{ color: 'primary.main', mr: 2, fontSize: 32 }} />
                                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                    <Typography variant="body1" sx={{ textDecoration: 'line-through', color: 'text.secondary' }} noWrap>
                                        {folder.name}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" textTransform="uppercase">
                                        Folder
                                    </Typography>
                                </Box>
                                <Button 
                                    variant="outlined" 
                                    startIcon={<RestoreIcon />}
                                    onClick={() => restoreItem.mutate({ type: 'folder', id: folder.id })}
                                >
                                    Restore
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                    
                    {files.map(file => (
                        <Card key={file.id} variant="outlined" sx={{ flexShrink: 0 }}>
                            <CardContent sx={{ display: 'flex', alignItems: 'center', p: 2, '&:last-child': { pb: 2 } }}>
                                <DocumentIcon sx={{ color: 'text.secondary', mr: 2, fontSize: 32 }} />
                                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                    <Typography variant="body1" sx={{ textDecoration: 'line-through', color: 'text.secondary' }} noWrap>
                                        {file.original_name || file.name}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" textTransform="uppercase">
                                        File
                                    </Typography>
                                </Box>
                                <Button 
                                    variant="outlined" 
                                    startIcon={<RestoreIcon />}
                                    onClick={() => restoreItem.mutate({ type: 'file', id: file.id })}
                                >
                                    Restore
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </Stack>
            )}

            <ConfirmModal 
                isOpen={isConfirmOpen}
                onClose={() => setIsConfirmOpen(false)}
                onConfirm={() => {
                    emptyTrash.mutate(undefined, {
                        onSuccess: () => setIsConfirmOpen(false)
                    });
                }}
                title="Empty Trash"
                message="Are you sure you want to permanently delete all items in the trash? This action cannot be undone."
                confirmText="Empty Trash"
                isDestructive={true}
                isPending={emptyTrash.isPending}
            />
        </Box>
    );
}
