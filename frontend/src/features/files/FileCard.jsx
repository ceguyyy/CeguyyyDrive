import React, { useState } from 'react';
import { InsertDriveFile as DocumentIcon, Image as ImageIcon } from '@mui/icons-material';
import { Card, CardActionArea, CardContent, Typography, Box, Checkbox, Skeleton } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import ContextMenu from '../../components/ui/ContextMenu';
import RenameModal from '../../components/modals/RenameModal';
import FilePreviewModal from '../../components/modals/FilePreviewModal';
import ShareModal from '../../components/modals/ShareModal';
import { useItemActions } from '../../hooks/useItemActions';

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function FileCard({ file, selected = false, onSelect = () => {}, selectionMode = false, onCopyItem, onCutItem }) {
    const [isRenameOpen, setIsRenameOpen] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isShareOpen, setIsShareOpen] = useState(false);
    const { renameFile, deleteFile } = useItemActions(file.folder_id);

    const displayName = file.original_name || file.name;
    const isImage = file.mime_type?.startsWith('image/');

    const { data: thumbnailUrl, isLoading: isThumbnailLoading } = useQuery({
        queryKey: ['thumbnail', file.id],
        queryFn: async () => {
            const res = await api.get(`/storage/download-url/${file.id}`);
            return res.data.data.downloadUrl;
        },
        enabled: isImage,
        staleTime: 1000 * 60 * 15 // 15 mins cache
    });

    const handleCardClick = (e) => {
        if (selectionMode) {
            e.preventDefault();
            onSelect();
        } else {
            setIsPreviewOpen(true);
        }
    };

    return (
        <>
            <Card 
                draggable
                onDragStart={(e) => {
                    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'file', id: file.id }));
                    e.dataTransfer.effectAllowed = 'move';
                }}
                elevation={0} 
                sx={{ 
                    aspectRatio: '1 / 1', overflow: 'hidden', height: '100%', 
                    display: 'flex', flexDirection: 'column', position: 'relative',
                    border: selected ? '2px solid #1976d2' : '1px solid transparent',
                    '&:hover .selection-checkbox': { opacity: 1 },
                    cursor: 'grab',
                    '&:active': { cursor: 'grabbing' }
                }}
            >
                <Checkbox 
                    className="selection-checkbox"
                    checked={selected}
                    onChange={(e) => { e.stopPropagation(); onSelect(); }}
                    onClick={(e) => e.stopPropagation()}
                    sx={{ 
                        position: 'absolute', top: 4, left: 4, zIndex: 2,
                        opacity: selected || selectionMode ? 1 : 0, transition: 'opacity 0.2s'
                    }}
                />
                <CardActionArea onClick={handleCardClick} sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ 
                        bgcolor: '#F7F7F5', 
                        flex: 1, 
                        width: '100%',
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        borderBottom: '1px solid #EAEAEA',
                        position: 'relative'
                    }}>
                        {isImage ? (
                            isThumbnailLoading ? (
                                <Skeleton variant="rectangular" width="100%" height="100%" />
                            ) : thumbnailUrl ? (
                                <Box
                                    component="img"
                                    src={thumbnailUrl}
                                    alt={displayName}
                                    sx={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover'
                                    }}
                                />
                            ) : (
                                <ImageIcon sx={{ fontSize: 64, color: 'text.secondary' }} />
                            )
                        ) : (
                            <DocumentIcon sx={{ fontSize: 64, color: 'text.secondary' }} />
                        )}
                    </Box>
                </CardActionArea>
                <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="body2" fontWeight="500" noWrap title={displayName}>
                            {displayName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap display="block">
                            {formatBytes(file.size)} {file.created_at ? `• ${new Date(file.created_at).toLocaleDateString()}` : ''}
                        </Typography>
                    </Box>
                    <ContextMenu 
                        onRename={() => setIsRenameOpen(true)}
                        onDelete={() => deleteFile.mutate(file.id)}
                        onShare={() => setIsShareOpen(true)}
                        onCopy={() => onCopyItem?.('file', file.id)}
                        onCut={() => onCutItem?.('file', file.id)}
                    />
                </CardContent>
            </Card>

            <RenameModal 
                isOpen={isRenameOpen}
                currentName={displayName}
                onClose={() => setIsRenameOpen(false)}
                onSave={(newName) => renameFile.mutate({ id: file.id, newName })}
            />

            <FilePreviewModal
                isOpen={isPreviewOpen}
                onClose={() => setIsPreviewOpen(false)}
                file={file}
            />

            <ShareModal
                isOpen={isShareOpen}
                onClose={() => setIsShareOpen(false)}
                itemType="file"
                itemId={file.id}
                itemName={displayName}
            />
        </>
    );
}
