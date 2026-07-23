import React, { useState, useMemo } from 'react';
import { useParams, Link as RouterLink, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import FileGrid from '../features/files/FileGrid';
import { Typography, Box, CircularProgress, Alert, Breadcrumbs, Link, Button, IconButton, Select, MenuItem, Pagination, Fab } from '@mui/material';
import { NavigateNext as NavigateNextIcon, CloudUpload as CloudUploadIcon, Delete as DeleteIcon, Sort as SortIcon, ArrowUpward, ArrowDownward, Download as DownloadIcon, ContentPaste as ContentPasteIcon, Close as CloseIcon, ContentCopy as CopyIcon, ContentCut as CutIcon } from '@mui/icons-material';
import { useUpload } from '../hooks/useUpload';
import { useItemActions } from '../hooks/useItemActions';
import { useClipboardStore } from '../store/clipboardStore';
import ConfirmModal from '../components/modals/ConfirmModal';

export default function Dashboard() {
    const { folderId } = useParams();
    const currentFolderId = folderId || 'root';
    const uploadMutation = useUpload(currentFolderId);
    const { bulkDelete, copyFile, copyFolder, moveFile, moveFolder } = useItemActions(currentFolderId);
    const { clipboard, setClipboard, clearClipboard } = useClipboardStore();
    
    const [isDragging, setIsDragging] = useState(false);
    
    // Sort State
    const [sortBy, setSortBy] = useState('name');
    const [sortOrder, setSortOrder] = useState('asc'); // 'asc' or 'desc'

    const [searchParams] = useSearchParams();
    const searchQuery = (searchParams.get('q') || '').toLowerCase();

    // Pagination State
    const [visibleItems, setVisibleItems] = useState(20);

    // Selection State
    const [selectedFolders, setSelectedFolders] = useState(new Set());
    const [selectedFiles, setSelectedFiles] = useState(new Set());

    // Reset pagination when folder changes
    React.useEffect(() => { setVisibleItems(20); }, [currentFolderId, sortBy, sortOrder, searchQuery]);

    const { data, isLoading, error } = useQuery({
        queryKey: ['folders', currentFolderId],
        queryFn: async () => {
            const res = await api.get(`/folders/${currentFolderId}`);
            return res.data.data;
        }
    });

    const dragCounter = React.useRef(0);

    const handleDragEnter = (e) => {
        e.preventDefault();
        if (!e.dataTransfer.types || !e.dataTransfer.types.includes('Files')) return;
        dragCounter.current += 1;
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            setIsDragging(true);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        if (!e.dataTransfer.types || !e.dataTransfer.types.includes('Files')) return;
        dragCounter.current -= 1;
        if (dragCounter.current === 0) {
            setIsDragging(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        if (!e.dataTransfer.types || !e.dataTransfer.types.includes('Files')) return;
        dragCounter.current = 0;
        setIsDragging(false);
        const files = Array.from(e.dataTransfer.files);
        files.forEach(file => uploadMutation.mutate(file));
    };

    // Keyboard Shortcuts for Clipboard
    React.useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'c' || e.key === 'x') {
                    if (selectedFolders.size > 0 || selectedFiles.size > 0) {
                        const items = [
                            ...Array.from(selectedFolders).map(id => ({ type: 'folder', id })),
                            ...Array.from(selectedFiles).map(id => ({ type: 'file', id }))
                        ];
                        setClipboard(e.key === 'c' ? 'copy' : 'cut', items);
                    }
                } else if (e.key === 'v') {
                    handlePaste();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedFolders, selectedFiles, clipboard, currentFolderId]);

    const handlePaste = async () => {
        if (!clipboard.action || clipboard.items.length === 0) return;
        
        const isRoot = currentFolderId === 'root';
        const targetId = isRoot ? null : currentFolderId;

        const promises = clipboard.items.map(item => {
            if (clipboard.action === 'copy') {
                return item.type === 'folder' 
                    ? copyFolder.mutateAsync({ id: item.id, targetFolderId: targetId })
                    : copyFile.mutateAsync({ id: item.id, targetFolderId: targetId });
            } else {
                return item.type === 'folder'
                    ? moveFolder.mutateAsync({ id: item.id, targetFolderId: targetId })
                    : moveFile.mutateAsync({ id: item.id, targetFolderId: targetId });
            }
        });

        await Promise.all(promises);
        if (clipboard.action === 'cut') {
            clearClipboard();
        }
    };

    const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);

    const handleBulkDelete = () => {
        bulkDelete.mutate({
            folderIds: Array.from(selectedFolders),
            fileIds: Array.from(selectedFiles)
        }, {
            onSuccess: () => {
                setSelectedFolders(new Set());
                setSelectedFiles(new Set());
                setIsBulkDeleteOpen(false);
            }
        });
    };

    const [isBulkDownloading, setIsBulkDownloading] = useState(false);

    const handleBulkDownload = async () => {
        if (selectedFiles.size === 0) return;
        setIsBulkDownloading(true);
        
        const fileIds = Array.from(selectedFiles);
        const fileObjects = data?.files?.filter(f => selectedFiles.has(f.id)) || [];

        try {
            for (const file of fileObjects) {
                const res = await api.get(`/storage/download-url/${file.id}`);
                const previewUrl = res.data.data.downloadUrl;
                
                const response = await fetch(previewUrl);
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = file.original_name || file.name;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            }
            setSelectedFiles(new Set());
            setSelectedFolders(new Set());
        } catch (err) {
            alert("Error during bulk download.");
        } finally {
            setIsBulkDownloading(false);
        }
    };

    if (isLoading) return (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
            <CircularProgress />
        </Box>
    );

    if (error) return (
        <Alert severity="error" sx={{ m: 4 }}>
            Failed to load drive: {error.message}
        </Alert>
    );

    let folders = data.subfolders || [];
    let files = data.files || [];
    const currentFolder = data.folder;

    // Apply Search Filter
    if (searchQuery) {
        folders = folders.filter(f => f.name.toLowerCase().includes(searchQuery));
        files = files.filter(f => (f.original_name || f.name).toLowerCase().includes(searchQuery));
    }

    // Apply Sorting
    const sortMultiplier = sortOrder === 'asc' ? 1 : -1;
    
    folders = [...folders].sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name) * sortMultiplier;
        if (sortBy === 'date') return (new Date(a.created_at) - new Date(b.created_at)) * sortMultiplier;
        return a.name.localeCompare(b.name) * sortMultiplier;
    });

    files = [...files].sort((a, b) => {
        if (sortBy === 'name') return (a.original_name || a.name).localeCompare(b.original_name || b.name) * sortMultiplier;
        if (sortBy === 'date') return (new Date(a.created_at) - new Date(b.created_at)) * sortMultiplier;
        if (sortBy === 'size') return (a.size - b.size) * sortMultiplier;
        return 0;
    });

    // Apply Visible Items Limit (View More logic)
    const totalItems = folders.length + files.length;
    
    let paginatedFolders = [];
    let paginatedFiles = [];

    if (visibleItems < folders.length) {
        paginatedFolders = folders.slice(0, visibleItems);
        paginatedFiles = [];
    } else {
        paginatedFolders = folders;
        const remainingSpace = visibleItems - folders.length;
        paginatedFiles = files.slice(0, remainingSpace);
    }

    const isSelectionActive = selectedFolders.size > 0 || selectedFiles.size > 0;

    return (
        <Box 
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            sx={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}
        >
            {isDragging && (
                <Box sx={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    bgcolor: 'rgba(255, 255, 255, 0.9)',
                    zIndex: 10, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    border: '3px dashed #EB5757', borderRadius: 2, m: 2
                }}>
                    <CloudUploadIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                    <Typography variant="h5" fontWeight="bold" color="text.primary">
                        Drop files here to upload
                    </Typography>
                </Box>
            )}

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                {isSelectionActive ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, bgcolor: '#F7F7F5', px: 2, py: 1, borderRadius: 2, flex: 1, mr: 2 }}>
                        <Typography variant="subtitle1" fontWeight="bold">
                            {selectedFolders.size + selectedFiles.size} items selected
                        </Typography>
                        <Button 
                            variant="outlined" 
                            size="small" 
                            onClick={() => { setSelectedFolders(new Set()); setSelectedFiles(new Set()); }}
                        >
                            Cancel
                        </Button>
                        <Box sx={{ flex: 1 }} />
                        <Button 
                            variant="outlined" 
                            startIcon={<CopyIcon />}
                            onClick={() => {
                                const items = [
                                    ...Array.from(selectedFolders).map(id => ({ type: 'folder', id })),
                                    ...Array.from(selectedFiles).map(id => ({ type: 'file', id }))
                                ];
                                setClipboard('copy', items);
                                setSelectedFolders(new Set());
                                setSelectedFiles(new Set());
                            }}
                            sx={{ mr: 1 }}
                        >
                            Copy
                        </Button>
                        <Button 
                            variant="outlined" 
                            startIcon={<CutIcon />}
                            onClick={() => {
                                const items = [
                                    ...Array.from(selectedFolders).map(id => ({ type: 'folder', id })),
                                    ...Array.from(selectedFiles).map(id => ({ type: 'file', id }))
                                ];
                                setClipboard('cut', items);
                                setSelectedFolders(new Set());
                                setSelectedFiles(new Set());
                            }}
                            sx={{ mr: 1 }}
                        >
                            Cut
                        </Button>
                        <Button 
                            variant="outlined" 
                            startIcon={<DownloadIcon />}
                            onClick={handleBulkDownload}
                            disabled={isBulkDownloading || selectedFiles.size === 0}
                            sx={{ mr: 1 }}
                        >
                            {isBulkDownloading ? 'Downloading...' : 'Download Files'}
                        </Button>
                        <Button 
                            variant="contained" 
                            color="error" 
                            startIcon={<DeleteIcon />}
                            onClick={() => setIsBulkDeleteOpen(true)}
                            disabled={bulkDelete.isPending}
                        >
                            {bulkDelete.isPending ? 'Deleting...' : 'Delete Selected'}
                        </Button>
                    </Box>
                ) : (
                    <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} aria-label="breadcrumb">
                        <Link 
                            component={RouterLink} 
                            to="/drive" 
                            underline="hover" 
                            color={currentFolder ? 'text.secondary' : 'text.primary'}
                            sx={{ fontSize: '1.25rem', fontWeight: currentFolder ? 500 : 700 }}
                        >
                            My Drive
                        </Link>
                        {currentFolder && (
                            <Typography color="text.primary" sx={{ fontSize: '1.25rem', fontWeight: 700 }}>
                                {currentFolder.name}
                            </Typography>
                        )}
                    </Breadcrumbs>
                )}

                {!isSelectionActive && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            size="small"
                            variant="outlined"
                            sx={{ minWidth: 120, height: 36 }}
                        >
                            <MenuItem value="name">Name</MenuItem>
                            <MenuItem value="date">Date Modified</MenuItem>
                            <MenuItem value="size">Size</MenuItem>
                        </Select>
                        <IconButton onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')} size="small">
                            {sortOrder === 'asc' ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />}
                        </IconButton>
                    </Box>
                )}
            </Box>
            
            <Box sx={{ flex: 1, overflow: 'auto' }}>
                <FileGrid 
                    folders={paginatedFolders} 
                    files={paginatedFiles} 
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    selectedFolders={selectedFolders}
                    selectedFiles={selectedFiles}
                    onToggleFolder={(id) => {
                        const newSet = new Set(selectedFolders);
                        if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
                        setSelectedFolders(newSet);
                    }}
                    onToggleFile={(id) => {
                        const newSet = new Set(selectedFiles);
                        if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
                        setSelectedFiles(newSet);
                    }}
                    selectionMode={isSelectionActive}
                    onCopyItem={(type, id) => setClipboard('copy', [{ type, id }])}
                    onCutItem={(type, id) => setClipboard('cut', [{ type, id }])}
                />
            </Box>

            {totalItems > visibleItems && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3, borderTop: '1px solid #EAEAEA' }}>
                    <Button 
                        variant="outlined" 
                        onClick={() => setVisibleItems(prev => prev + 20)}
                        sx={{ borderRadius: 8, px: 4 }}
                    >
                        View More
                    </Button>
                </Box>
            )}

            <ConfirmModal 
                isOpen={isBulkDeleteOpen}
                onClose={() => setIsBulkDeleteOpen(false)}
                onConfirm={handleBulkDelete}
                title="Move to Trash"
                message={`Are you sure you want to move ${selectedFolders.size + selectedFiles.size} items to trash?`}
                confirmText="Move to Trash"
                isDestructive={true}
                isPending={bulkDelete.isPending}
            />

            {clipboard.items.length > 0 && (
                <Box sx={{ position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)', zIndex: 1200, display: 'flex', gap: 1 }}>
                    <Fab variant="extended" color="primary" onClick={handlePaste}>
                        <ContentPasteIcon sx={{ mr: 1 }} />
                        Paste ({clipboard.items.length})
                    </Fab>
                    <Fab color="default" size="medium" onClick={clearClipboard}>
                        <CloseIcon />
                    </Fab>
                </Box>
            )}
        </Box>
    );
}
