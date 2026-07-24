import React, { useState } from 'react';
import { IconButton, Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import { 
    MoreVert as MoreVertIcon, 
    Edit as EditIcon, 
    Delete as DeleteIcon, 
    Share as ShareIcon,
    ContentCopy as CopyIcon,
    ContentCut as CutIcon
} from '@mui/icons-material';
import ConfirmModal from '../modals/ConfirmModal';

export default function ContextMenu({ onRename, onDelete, onShare, onCopy, onCut }) {
    const [anchorEl, setAnchorEl] = useState(null);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const open = Boolean(anchorEl);

    const handleClick = (event) => {
        event.stopPropagation();
        setAnchorEl(event.currentTarget);
    };

    const handleClose = (event) => {
        if (event) event.stopPropagation();
        setAnchorEl(null);
    };

    const handleDeleteClick = (e) => {
        handleClose(e);
        setIsConfirmOpen(true);
    };

    return (
        <div>
            <IconButton 
                onClick={handleClick}
                size="small"
                aria-label="Open context menu"
                sx={{ opacity: 0, '.MuiCard-root:hover &': { opacity: 1 }, transition: 'opacity 0.2s' }}
                className="context-menu-trigger"
            >
                <MoreVertIcon />
            </IconButton>
            
            <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                onClick={(e) => e.stopPropagation()} 
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                <MenuItem onClick={(e) => { handleClose(e); onRename(); }}>
                    <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>Rename</ListItemText>
                </MenuItem>
                
                {onCopy && (
                    <MenuItem onClick={(e) => { handleClose(e); onCopy(); }}>
                        <ListItemIcon><CopyIcon fontSize="small" /></ListItemIcon>
                        <ListItemText>Copy</ListItemText>
                    </MenuItem>
                )}
                
                {onCut && (
                    <MenuItem onClick={(e) => { handleClose(e); onCut(); }}>
                        <ListItemIcon><CutIcon fontSize="small" /></ListItemIcon>
                        <ListItemText>Cut</ListItemText>
                    </MenuItem>
                )}
                
                {onShare && (
                    <MenuItem onClick={(e) => { handleClose(e); onShare(); }}>
                        <ListItemIcon><ShareIcon fontSize="small" /></ListItemIcon>
                        <ListItemText>Share</ListItemText>
                    </MenuItem>
                )}
                
                <MenuItem onClick={handleDeleteClick} sx={{ color: 'error.main' }}>
                    <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
                    <ListItemText>Move to Trash</ListItemText>
                </MenuItem>
            </Menu>

            <ConfirmModal 
                isOpen={isConfirmOpen}
                onClose={() => setIsConfirmOpen(false)}
                onConfirm={() => {
                    setIsConfirmOpen(false);
                    onDelete();
                }}
                title="Move to Trash"
                message="Are you sure you want to move this item to trash?"
                confirmText="Move to Trash"
                isDestructive={true}
            />
        </div>
    );
}
