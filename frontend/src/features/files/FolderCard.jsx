import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Folder as FolderIcon } from '@mui/icons-material';
import { Card, CardActionArea, CardContent, Typography, Box, Checkbox } from '@mui/material';
import ContextMenu from '../../components/ui/ContextMenu';
import RenameModal from '../../components/modals/RenameModal';
import ShareModal from '../../components/modals/ShareModal';
import { useItemActions } from '../../hooks/useItemActions';

export default function FolderCard({ 
    folder, selected = false, onSelect = () => {}, selectionMode = false, 
    onCopyItem, onCutItem, onOpen, customRenameFolder, customDeleteFolder 
}) {
    const [isRenameOpen, setIsRenameOpen] = useState(false);
    const [isShareOpen, setIsShareOpen] = useState(false);
    const { renameFolder: defaultRename, deleteFolder: defaultDelete, moveFile, moveFolder } = useItemActions(folder.parent_id);
    const renameFolder = customRenameFolder || defaultRename;
    const deleteFolder = customDeleteFolder || defaultDelete;
    const navigate = useNavigate();
    const [isDragOver, setIsDragOver] = useState(false);

    const handleCardClick = (e) => {
        if (selectionMode) {
            e.preventDefault();
            onSelect();
        } else if (onOpen) {
            onOpen(folder.id);
        } else {
            navigate('/drive/folders/' + folder.id);
        }
    };

    return (
        <>
            <Card 
                draggable
                onDragStart={(e) => {
                    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'folder', id: folder.id }));
                    e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                    e.preventDefault();
                    if (!isDragOver) setIsDragOver(true);
                }}
                onDragLeave={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                }}
                onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation(); // Prevent the parent Dashboard from trying to upload it as a file
                    setIsDragOver(false);
                    
                    try {
                        const dataString = e.dataTransfer.getData('application/json');
                        if (!dataString) return;
                        
                        const data = JSON.parse(dataString);
                        if (data.id === folder.id) return; // Cannot drop into itself
                        
                        if (data.type === 'file') {
                            moveFile.mutate({ id: data.id, targetFolderId: folder.id });
                        } else if (data.type === 'folder') {
                            moveFolder.mutate({ id: data.id, targetFolderId: folder.id });
                        }
                    } catch (err) {
                        // Not a valid JSON payload from our internal drag
                    }
                }}
                elevation={0} 
                sx={{ 
                    aspectRatio: '1 / 1', overflow: 'hidden', height: '100%', 
                    display: 'flex', flexDirection: 'column', position: 'relative',
                    border: selected ? '2px solid #1976d2' : isDragOver ? '2px dashed #1976d2' : '1px solid transparent',
                    bgcolor: isDragOver ? 'rgba(25, 118, 210, 0.08)' : 'background.paper',
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
                <CardActionArea 
                    component="div"
                    onClick={handleCardClick}
                    sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 2 }}
                >
                    <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                        <FolderIcon sx={{ color: 'text.secondary', fontSize: 64 }} />
                    </Box>
                    <Box sx={{ width: '100%', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mt: 1 }}>
                        <Box sx={{ minWidth: 0, flex: 1, pr: 1, textAlign: 'left' }}>
                            <Typography variant="body2" fontWeight="500" noWrap>
                                {folder.name}
                            </Typography>
                            {folder.created_at && (
                                <Typography variant="caption" color="text.secondary" noWrap display="block">
                                    Created {new Date(folder.created_at).toLocaleDateString()}
                                </Typography>
                            )}
                        </Box>
                        <ContextMenu 
                            onRename={() => setIsRenameOpen(true)}
                            onDelete={() => deleteFolder.mutate(folder.id)}
                            onShare={() => setIsShareOpen(true)}
                            onCopy={() => onCopyItem?.('folder', folder.id)}
                            onCut={() => onCutItem?.('folder', folder.id)}
                        />
                    </Box>
                </CardActionArea>
            </Card>

            <RenameModal 
                isOpen={isRenameOpen}
                currentName={folder.name}
                onClose={() => setIsRenameOpen(false)}
                onSave={(newName) => renameFolder.mutate({ id: folder.id, newName })}
            />

            <ShareModal
                isOpen={isShareOpen}
                onClose={() => setIsShareOpen(false)}
                itemType="folder"
                itemId={folder.id}
                itemName={folder.name}
            />
        </>
    );
}
