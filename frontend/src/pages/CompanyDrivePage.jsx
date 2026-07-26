import React, { useState, useRef } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Box, Typography, Button, CircularProgress, Alert, Breadcrumbs,
    Link, Menu, MenuItem, ListItemIcon, ListItemText, IconButton, Tooltip, ToggleButtonGroup, ToggleButton, Select
} from '@mui/material';
import {
    Add as PlusIcon,
    CreateNewFolder as CreateNewFolderIcon,
    UploadFile as UploadFileIcon,
    Business as OrgIcon,
    Folder as FolderIcon,
    CloudUpload as CloudUploadIcon,
    GridView as GridViewIcon,
    ViewList as ViewListIcon,
    ArrowUpward as ArrowUpwardIcon,
    ArrowDownward as ArrowDownwardIcon
} from '@mui/icons-material';
import api from '../services/api';
import FileGrid from '../features/files/FileGrid';
import FolderCard from '../features/files/FolderCard';
import FileCard from '../features/files/FileCard';
import CreateFolderModal from '../components/modals/CreateFolderModal';
import { useOrgUpload } from '../hooks/useOrgUpload';
import { useOrgItemActions } from '../hooks/useOrgItemActions';

export default function CompanyDrivePage() {
    const { orgId, folderId } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const fileInputRef = useRef(null);

    const [anchorEl, setAnchorEl] = useState(null);
    const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [viewMode, setViewMode] = useState(() => localStorage.getItem('ceguyyy_view_mode') || 'grid');
    const [sortBy, setSortBy] = useState('name');
    const [sortOrder, setSortOrder] = useState('asc');

    const uploadMutation = useOrgUpload(orgId, folderId);
    const { renameFolder, deleteFolder, renameFile, deleteFile } = useOrgItemActions(orgId, folderId);

    // Fetch org details
    const { data: orgsData } = useQuery({
        queryKey: ['organizations'],
        queryFn: async () => {
            const res = await api.get('/organizations');
            return res.data.data;
        }
    });
    const orgs = orgsData?.organizations ?? [];
    const currentOrg = orgs.find(o => o.id === orgId);

    // Fetch drive contents
    const { data: contents, isLoading, isError, error } = useQuery({
        queryKey: ['org-drive', orgId, folderId || 'root'],
        queryFn: async () => {
            const url = folderId
                ? `/organizations/${orgId}/drive/folders/${folderId}`
                : `/organizations/${orgId}/drive/folders`;
            const res = await api.get(url);
            return res.data.data;
        }
    });

    const createFolderMutation = useMutation({
        mutationFn: async (name) => {
            const res = await api.post(`/organizations/${orgId}/drive/folders`, {
                name,
                parentFolderId: folderId
            });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['org-drive', orgId] });
            setIsCreateFolderOpen(false);
        }
    });

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            uploadMutation.mutate(file);
        }
        setAnchorEl(null);
        e.target.value = null;
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isDragging) setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.currentTarget.contains(e.relatedTarget)) return;
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const droppedFiles = e.dataTransfer.files;
        if (droppedFiles && droppedFiles.length > 0) {
            if (!folderId) {
                alert('Please select and enter a role folder (e.g. Owner, Manager) first before uploading files.');
                return;
            }
            uploadMutation.mutate(droppedFiles[0]);
        }
    };

    const { folders = [], files = [] } = contents || {};

    const sortedFolders = React.useMemo(() => {
        return [...folders].sort((a, b) => {
            if (sortBy === 'name') {
                return sortOrder === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
            }
            if (sortBy === 'date') {
                const dateA = new Date(a.created_at || 0);
                const dateB = new Date(b.created_at || 0);
                return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
            }
            return 0;
        });
    }, [folders, sortBy, sortOrder]);

    const sortedFiles = React.useMemo(() => {
        return [...files].sort((a, b) => {
            if (sortBy === 'name') {
                const nameA = a.original_name || a.name || '';
                const nameB = b.original_name || b.name || '';
                return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
            }
            if (sortBy === 'date') {
                const dateA = new Date(a.updated_at || a.created_at || 0);
                const dateB = new Date(b.updated_at || b.created_at || 0);
                return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
            }
            if (sortBy === 'size') {
                const sizeA = a.size || 0;
                const sizeB = b.size || 0;
                return sortOrder === 'asc' ? sizeA - sizeB : sizeB - sizeA;
            }
            return 0;
        });
    }, [files, sortBy, sortOrder]);

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
                {error?.response?.data?.message || 'Access denied or failed to load Company Drive'}
            </Alert>
        );
    }

    return (
        <Box
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            sx={{ position: 'relative', minHeight: '80vh', p: 3 }}
        >
            {/* Drag Overlay */}
            {isDragging && (
                <Box
                    sx={{
                        position: 'fixed',
                        top: 0, left: 0, right: 0, bottom: 0,
                        bgcolor: 'rgba(25, 118, 210, 0.12)',
                        border: '3px dashed #1976d2',
                        zIndex: 9999,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backdropFilter: 'blur(3px)',
                        pointerEvents: 'none'
                    }}
                >
                    <CloudUploadIcon sx={{ fontSize: 72, color: 'primary.main', mb: 2 }} />
                    <Typography variant="h5" fontWeight="bold" color="primary">
                        Drop file to upload to Company Drive
                    </Typography>
                </Box>
            )}
            {/* Header / Breadcrumbs */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <OrgIcon sx={{ color: 'primary.main', fontSize: 28 }} />
                        <Typography variant="h5" fontWeight="bold">
                            {currentOrg?.name || 'Company Drive'}
                        </Typography>
                    </Box>
                    <Breadcrumbs aria-label="breadcrumb">
                        <Link component={RouterLink} to={`/company-drive/${orgId}`} color="inherit" underline="hover">
                            Company Drive Root
                        </Link>
                        {folderId && (
                            <Typography color="text.primary">Folder Contents</Typography>
                        )}
                    </Breadcrumbs>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, bgcolor: 'background.paper', p: 0.5, borderRadius: 1, border: '1px solid #E5E7EB', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>

                        <ToggleButtonGroup
                            value={viewMode}
                            exclusive
                            size="small"
                            onChange={(e, nextMode) => {
                                if (nextMode) {
                                    setViewMode(nextMode);
                                    localStorage.setItem('ceguyyy_view_mode', nextMode);
                                }
                            }}
                            aria-label="view mode toggle"
                            sx={{ height: 32 }}
                        >
                            <ToggleButton value="grid" aria-label="card view" sx={{ px: 1.5, gap: 0.5, textTransform: 'none', fontWeight: 600, fontSize: '0.8rem' }}>
                                <GridViewIcon sx={{ fontSize: '1.1rem' }} /> Card UI
                            </ToggleButton>
                            <ToggleButton value="list" aria-label="list view" sx={{ px: 1.5, gap: 0.5, textTransform: 'none', fontWeight: 600, fontSize: '0.8rem' }}>
                                <ViewListIcon sx={{ fontSize: '1.1rem' }} /> List UI
                            </ToggleButton>
                        </ToggleButtonGroup>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            size="small"
                            variant="outlined"
                            sx={{ minWidth: 110, height: 36, bgcolor: 'common.white', fontSize: '0.85rem' }}
                        >
                            <MenuItem value="name">Sort: Name</MenuItem>
                            <MenuItem value="date">Sort: Date</MenuItem>
                            <MenuItem value="size">Sort: Size</MenuItem>
                        </Select>
                        <Tooltip title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}>
                            <IconButton onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')} size="small" sx={{ bgcolor: 'common.white', border: '1px solid #E5E7EB', width: 36, height: 36 }}>
                                {sortOrder === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />}
                            </IconButton>
                        </Tooltip>
                    </Box>

                    {folderId && (
                        <Box>
                            <Button
                                variant="contained"
                                startIcon={<PlusIcon />}
                                onClick={(e) => setAnchorEl(e.currentTarget)}
                            >
                                New
                            </Button>
                            <Menu
                                anchorEl={anchorEl}
                                open={Boolean(anchorEl)}
                                onClose={() => setAnchorEl(null)}
                                PaperProps={{ sx: { width: 180 } }}
                            >
                                <MenuItem onClick={() => { setIsCreateFolderOpen(true); setAnchorEl(null); }}>
                                    <ListItemIcon><CreateNewFolderIcon fontSize="small" /></ListItemIcon>
                                    <ListItemText>New Subfolder</ListItemText>
                                </MenuItem>
                                <MenuItem onClick={() => fileInputRef.current?.click()}>
                                    <ListItemIcon><UploadFileIcon fontSize="small" /></ListItemIcon>
                                    <ListItemText>Upload File</ListItemText>
                                </MenuItem>
                            </Menu>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                style={{ display: 'none' }}
                            />
                        </Box>
                    )}
                </Box>
            </Box>

            {!folderId && (
                <Alert severity="info" sx={{ mb: 3 }}>
                    💡 <strong>Role Root Folders:</strong> Select a role folder below (e.g. <em>Owner</em>, <em>Manager</em>) to upload files or create subfolders within that role's shared drive space.
                </Alert>
            )}

            {/* Folders Section */}
            {sortedFolders.length > 0 && (
                <Box sx={{ mb: 4 }}>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
                        Folders ({sortedFolders.length})
                    </Typography>
                    <FileGrid viewMode={viewMode}>
                        {sortedFolders.map(folder => (
                            <FolderCard
                                key={folder.id}
                                folder={folder}
                                onOpen={(id) => navigate(`/company-drive/${orgId}/folders/${id}`)}
                                customRenameFolder={renameFolder}
                                customDeleteFolder={deleteFolder}
                                viewMode={viewMode}
                            />
                        ))}
                    </FileGrid>
                </Box>
            )}

            {/* Files Section */}
            {sortedFiles.length > 0 && (
                <Box>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
                        Files ({sortedFiles.length})
                    </Typography>
                    <FileGrid viewMode={viewMode}>
                        {sortedFiles.map(file => (
                            <FileCard
                                key={file.id}
                                file={file}
                                customRenameFile={renameFile}
                                customDeleteFile={deleteFile}
                                viewMode={viewMode}
                            />
                        ))}
                    </FileGrid>
                </Box>
            )}

            {folders.length === 0 && files.length === 0 && (
                <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
                    <FolderIcon sx={{ fontSize: 64, color: '#D1D5DB', mb: 1 }} />
                    <Typography variant="h6">This folder is empty</Typography>
                    {folderId && (
                        <Typography variant="body2">Use the "New" button to create subfolders or upload files.</Typography>
                    )}
                </Box>
            )}

            {/* Create Folder Modal */}
            <CreateFolderModal
                isOpen={isCreateFolderOpen}
                onClose={() => setIsCreateFolderOpen(false)}
                onSave={(name) => createFolderMutation.mutate(name)}
            />
        </Box>
    );
}
