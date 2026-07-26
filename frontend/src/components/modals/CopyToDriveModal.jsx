import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography,
    List, ListItemButton, ListItemIcon, ListItemText, CircularProgress, Alert,
    Breadcrumbs, Link, TextField, MenuItem
} from '@mui/material';
import {
    Folder as FolderIcon,
    Home as HomeIcon,
    ChevronRight as ChevronRightIcon
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';

/**
 * Copies a single file between My Drive and Company Drive.
 *
 * Direction is derived from the file itself: a file carrying organization_id
 * lives in a Company Drive and can only be copied out to My Drive, and vice
 * versa. The destination is chosen by browsing the target drive, so the user
 * sees the folders they can actually write to before the copy runs.
 */
export default function CopyToDriveModal({ isOpen, onClose, file }) {
    const queryClient = useQueryClient();
    const isFromOrg = Boolean(file?.organization_id);

    const [orgId, setOrgId] = useState('');
    // Breadcrumb trail of the destination drive. null id == drive root.
    const [path, setPath] = useState([{ id: null, name: 'Root' }]);
    const [error, setError] = useState('');

    const currentFolderId = path[path.length - 1].id;

    useEffect(() => {
        if (isOpen) {
            setPath([{ id: null, name: isFromOrg ? 'My Drive' : 'Company Drive' }]);
            setError('');
        }
    }, [isOpen, isFromOrg]);

    // Organizations are only needed when copying INTO a Company Drive.
    const { data: orgsData } = useQuery({
        queryKey: ['organizations'],
        queryFn: async () => {
            const res = await api.get('/organizations');
            return res.data.data;
        },
        enabled: isOpen && !isFromOrg
    });
    const organizations = orgsData?.organizations ?? [];

    // Derived, not stored: defaulting via useEffect would re-run on every
    // render, since `organizations` is a fresh array each time.
    const activeOrgId = orgId || organizations[0]?.id || '';

    const { data: folders = [], isLoading: isFoldersLoading } = useQuery({
        queryKey: ['copy-picker', isFromOrg ? 'personal' : activeOrgId, currentFolderId],
        queryFn: async () => {
            if (isFromOrg) {
                const res = await api.get('/folders', {
                    params: currentFolderId ? { parentId: currentFolderId } : {}
                });
                return res.data.data.folders;
            }
            const suffix = currentFolderId ? `/${currentFolderId}` : '';
            const res = await api.get(`/organizations/${activeOrgId}/drive/folders${suffix}`);
            return res.data.data.folders;
        },
        enabled: isOpen && (isFromOrg || Boolean(activeOrgId))
    });

    const copyMutation = useMutation({
        mutationFn: async () => {
            if (isFromOrg) {
                const res = await api.post(
                    `/organizations/${file.organization_id}/drive/files/${file.id}/copy-to-personal`,
                    { destinationFolderId: currentFolderId }
                );
                return res.data.data.file;
            }
            const res = await api.post(`/organizations/${activeOrgId}/drive/copy-from-personal`, {
                fileId: file.id,
                destinationFolderId: currentFolderId
            });
            return res.data.data.file;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['files'] });
            queryClient.invalidateQueries({ queryKey: ['org-drive'] });
            onClose();
        },
        onError: (err) => {
            setError(err.response?.data?.message || 'Failed to copy the file.');
        }
    });

    // Company Drive files must live inside a role folder, never at the root.
    const needsFolder = !isFromOrg && !currentFolderId;
    const title = isFromOrg ? 'Copy to My Drive' : 'Copy to Company Drive';

    return (
        <Dialog open={isOpen} onClose={onClose} maxWidth="sm" fullWidth
            PaperProps={{ sx: { borderRadius: 3 } }}>
            <DialogTitle sx={{ fontWeight: 'bold' }}>{title}</DialogTitle>
            <DialogContent dividers>
                {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Copying <strong>{file?.original_name || file?.name}</strong>
                </Typography>

                {!isFromOrg && (
                    <TextField
                        select fullWidth size="small" label="Organization" sx={{ mb: 2 }}
                        value={activeOrgId}
                        onChange={(e) => { setOrgId(e.target.value); setPath([{ id: null, name: 'Company Drive' }]); }}
                    >
                        {organizations.map(o => (
                            <MenuItem key={o.id} value={o.id}>{o.name}</MenuItem>
                        ))}
                    </TextField>
                )}

                <Breadcrumbs separator={<ChevronRightIcon fontSize="small" />} sx={{ mb: 1 }}>
                    {path.map((p, i) => (
                        i === path.length - 1
                            ? <Typography key={i} variant="body2" color="text.primary" sx={{ fontWeight: 600 }}>{p.name}</Typography>
                            : <Link key={i} component="button" variant="body2" underline="hover"
                                onClick={() => setPath(path.slice(0, i + 1))}>
                                {i === 0 ? <HomeIcon fontSize="inherit" sx={{ verticalAlign: 'middle', mr: 0.5 }} /> : null}
                                {p.name}
                            </Link>
                    ))}
                </Breadcrumbs>

                <Box sx={{ minHeight: 200, maxHeight: 300, overflowY: 'auto', border: '1px solid #EAEAEA', borderRadius: 2 }}>
                    {isFoldersLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
                    ) : folders.length === 0 ? (
                        <Typography variant="body2" color="text.secondary" sx={{ p: 3, textAlign: 'center' }}>
                            No subfolders here.
                        </Typography>
                    ) : (
                        <List dense disablePadding>
                            {folders.map(f => (
                                <ListItemButton key={f.id}
                                    onClick={() => setPath([...path, { id: f.id, name: f.name }])}>
                                    <ListItemIcon sx={{ minWidth: 36 }}><FolderIcon fontSize="small" color="primary" /></ListItemIcon>
                                    <ListItemText primary={f.name} />
                                    <ChevronRightIcon fontSize="small" color="disabled" />
                                </ListItemButton>
                            ))}
                        </List>
                    )}
                </Box>

                {needsFolder && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                        Open a role folder to choose it as the destination.
                    </Typography>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button variant="contained"
                    disabled={copyMutation.isPending || needsFolder || (!isFromOrg && !activeOrgId)}
                    onClick={() => { setError(''); copyMutation.mutate(); }}>
                    {copyMutation.isPending ? 'Copying…' : `Copy here`}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
