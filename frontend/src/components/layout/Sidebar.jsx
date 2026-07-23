import React, { useState, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import CreateFolderModal from '../modals/CreateFolderModal';
import ProfileModal from '../modals/ProfileModal';
import { useUpload } from '../../hooks/useUpload';
import { 
    Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, 
    Button, Box, Typography, Divider, Menu, MenuItem, Avatar, LinearProgress
} from '@mui/material';
import { 
    Folder as FolderIcon, 
    Delete as TrashIcon, 
    Group as UsersIcon, 
    Add as PlusIcon, 
    Logout as LogoutIcon,
    CreateNewFolder as CreateNewFolderIcon,
    UploadFile as UploadFileIcon,
    Cloud as CloudIcon,
    Chat as ChatIcon
} from '@mui/icons-material';

const drawerWidth = 260;

export default function Sidebar() {
    const { logout, user, totalMemory } = useAuthStore();
    const [anchorEl, setAnchorEl] = useState(null);
    const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    
    const fileInputRef = useRef(null);
    const location = useLocation();
    const folderMatch = location.pathname.match(/\/drive\/folders\/([a-zA-Z0-9-]+)/);
    const currentFolderId = folderMatch ? folderMatch[1] : 'root';
    
    const uploadMutation = useUpload(currentFolderId);

    const handleMenuOpen = (event) => setAnchorEl(event.currentTarget);
    const handleMenuClose = () => setAnchorEl(null);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            uploadMutation.mutate(file);
        }
        handleMenuClose();
        e.target.value = null; // Reset input
    };

    const navItems = [
        { name: 'My Drive', path: '/drive', icon: <FolderIcon /> },
        { name: 'Shared with me', path: '/shared', icon: <UsersIcon /> },
        { name: 'Trash', path: '/trash', icon: <TrashIcon /> },
        { name: 'Chat', path: '/chat', icon: <ChatIcon /> },
    ];

    const TOTAL_STORAGE_LIMIT = 15 * 1024 * 1024 * 1024; // 15 GB
    const storagePercentage = Math.min((totalMemory / TOTAL_STORAGE_LIMIT) * 100, 100);

    const formatBytes = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <>
            <Drawer
                variant="permanent"
                sx={{
                    width: drawerWidth,
                    flexShrink: 0,
                    [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: 'border-box' },
                }}
            >
                <Box sx={{ p: 3, pb: 1, display: 'flex', alignItems: 'center' }}>
                    <Box 
                        sx={{ 
                            width: 24, height: 24, borderRadius: 1, mr: 1.5,
                            background: 'linear-gradient(135deg, #37352F 0%, #73726E 100%)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff', fontSize: '12px', fontWeight: 'bold'
                        }}
                    >
                        C
                    </Box>
                    <Typography variant="subtitle1" fontWeight="700">
                        CeguyyyDrive
                    </Typography>
                </Box>
                
                <Box sx={{ px: 2, pb: 2, pt: 1 }}>
                    <Button 
                        variant="outlined" 
                        fullWidth 
                        startIcon={<PlusIcon fontSize="small" />}
                        onClick={handleMenuOpen}
                        sx={{ 
                            justifyContent: 'flex-start',
                            py: 0.75, px: 1.5,
                            color: 'text.primary',
                            borderColor: 'transparent',
                            backgroundColor: 'transparent',
                            '&:hover': {
                                backgroundColor: 'action.hover',
                                borderColor: 'transparent',
                            },
                            fontWeight: 500,
                            fontSize: '0.875rem'
                        }}
                    >
                        New
                    </Button>
                    <Menu
                        anchorEl={anchorEl}
                        open={Boolean(anchorEl)}
                        onClose={handleMenuClose}
                        PaperProps={{ sx: { width: drawerWidth - 32, mt: 0.5 } }}
                        elevation={0}
                    >
                        <MenuItem onClick={() => { setIsFolderModalOpen(true); handleMenuClose(); }}>
                            <ListItemIcon><CreateNewFolderIcon fontSize="small" /></ListItemIcon>
                            <ListItemText>New Folder</ListItemText>
                        </MenuItem>
                        <MenuItem onClick={() => fileInputRef.current?.click()}>
                            <ListItemIcon><UploadFileIcon fontSize="small" /></ListItemIcon>
                            <ListItemText>File Upload</ListItemText>
                        </MenuItem>
                        <MenuItem onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.multiple = true;
                            input.webkitdirectory = true;
                            input.onchange = (e) => {
                                const files = Array.from(e.target.files);
                                files.forEach(file => uploadMutation.mutate(file));
                                handleMenuClose();
                            };
                            input.click();
                        }}>
                            <ListItemIcon><FolderIcon fontSize="small" /></ListItemIcon>
                            <ListItemText>Folder Upload</ListItemText>
                        </MenuItem>
                    </Menu>
                    <input 
                        type="file" 
                        multiple
                        className="hidden" 
                        ref={fileInputRef} 
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                    />
                </Box>
                
                <List sx={{ flex: 1, pt: 0, px: 2 }}>
                    {navItems.map((item) => (
                        <ListItem key={item.name} disablePadding sx={{ mb: 0.25 }}>
                            <ListItemButton 
                                component={NavLink} 
                                to={item.path}
                                sx={{ 
                                    py: 0.5, px: 1.5,
                                    '&.active': {
                                        backgroundColor: 'action.selected',
                                    },
                                    '& .MuiListItemIcon-root': { 
                                        minWidth: 32,
                                        color: 'text.secondary' 
                                    },
                                    '&.active .MuiListItemIcon-root': { 
                                        color: 'text.primary' 
                                    },
                                    '& .MuiListItemText-primary': { 
                                        fontSize: '0.875rem',
                                        fontWeight: 500,
                                        color: 'text.secondary'
                                    },
                                    '&.active .MuiListItemText-primary': { 
                                        fontWeight: 600,
                                        color: 'text.primary'
                                    }
                                }}
                            >
                                <ListItemIcon>
                                    {item.icon}
                                </ListItemIcon>
                                <ListItemText primary={item.name} />
                            </ListItemButton>
                        </ListItem>
                    ))}
                </List>

                {/* Storage and Profile Section */}
                <Box sx={{ p: 2 }}>
                    <Box sx={{ mb: 2, px: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, color: 'text.secondary' }}>
                            <CloudIcon fontSize="small" sx={{ mr: 1 }} />
                            <Typography variant="body2" fontWeight={500}>Storage</Typography>
                        </Box>
                        <LinearProgress 
                            variant="determinate" 
                            value={storagePercentage} 
                            sx={{ height: 6, borderRadius: 3, mb: 0.5 }}
                        />
                        <Typography variant="caption" color="text.secondary">
                            {formatBytes(totalMemory)} of 15 GB used
                        </Typography>
                    </Box>
                    <Divider sx={{ mb: 2 }} />
                    <Box 
                        sx={{ 
                            display: 'flex', alignItems: 'center', mb: 2, px: 1, 
                            cursor: 'pointer', '&:hover': { opacity: 0.8 } 
                        }}
                        onClick={() => setIsProfileModalOpen(true)}
                    >
                        <Avatar 
                            src={user?.profile_picture_url} 
                            sx={{ width: 32, height: 32, mr: 1.5, fontSize: '0.875rem' }}
                        >
                            {user?.full_name?.charAt(0)?.toUpperCase()}
                        </Avatar>
                        <Box sx={{ overflow: 'hidden' }}>
                            <Typography variant="body2" fontWeight={600} noWrap>
                                {user?.full_name || 'User'}
                            </Typography>
                        </Box>
                    </Box>
                    <Button 
                        color="inherit" 
                        fullWidth 
                        startIcon={<LogoutIcon fontSize="small" />}
                        onClick={logout}
                        sx={{ 
                            justifyContent: 'flex-start',
                            py: 0.75, px: 1.5,
                            color: 'text.secondary',
                            '&:hover': {
                                backgroundColor: 'action.hover',
                                color: 'text.primary'
                            },
                            fontWeight: 500,
                            fontSize: '0.875rem'
                        }}
                    >
                        Sign Out
                    </Button>
                </Box>
            </Drawer>

            <CreateFolderModal 
                isOpen={isFolderModalOpen} 
                onClose={() => setIsFolderModalOpen(false)}
                parentId={currentFolderId} 
            />
            
            <ProfileModal
                isOpen={isProfileModalOpen}
                onClose={() => setIsProfileModalOpen(false)}
            />
        </>
    );
}
