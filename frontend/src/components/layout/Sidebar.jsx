import React, { useState, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import CreateFolderModal from '../modals/CreateFolderModal';
import ProfileModal from '../modals/ProfileModal';
import { useUpload } from '../../hooks/useUpload';
import { useItemActions } from '../../hooks/useItemActions';
import { 
    Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, 
    Button, Box, Typography, Divider, Menu, MenuItem, Avatar, LinearProgress,
    IconButton, Tooltip
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
    Chat as ChatIcon,
    ChevronLeft as ChevronLeftIcon,
    ChevronRight as ChevronRightIcon,
    FactCheck as ApprovalIcon,
    Business as OrgIcon
} from '@mui/icons-material';

const EXPANDED_WIDTH = 260;
const COLLAPSED_WIDTH = 72;

export default function Sidebar() {
    const { logout, user, totalMemory } = useAuthStore();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    const [anchorEl, setAnchorEl] = useState(null);
    const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isMyDriveDragOver, setIsMyDriveDragOver] = useState(false);
    
    const fileInputRef = useRef(null);
    const location = useLocation();
    const folderMatch = location.pathname.match(/\/drive\/folders\/([a-zA-Z0-9-]+)/);
    const currentFolderId = folderMatch ? folderMatch[1] : 'root';
    
    const uploadMutation = useUpload(currentFolderId);
    const { moveFile, moveFolder } = useItemActions(currentFolderId);

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
        { name: 'Approvals', path: '/approvals', icon: <ApprovalIcon /> },
        { name: 'Organization', path: '/organization', icon: <OrgIcon /> },
        { name: 'Trash', path: '/trash', icon: <TrashIcon /> },
        { name: 'Chat', path: '/chat', icon: <ChatIcon /> },
    ];

    const TOTAL_STORAGE_LIMIT = 15 * 1024 * 1024 * 1024; // 15 GB
    const storagePercentage = Math.min((totalMemory / TOTAL_STORAGE_LIMIT) * 100, 100);

    const formatBytes = (bytes) => {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Effective display state
    const showFull = !isCollapsed || isHovered;
    const currentWidth = showFull ? EXPANDED_WIDTH : COLLAPSED_WIDTH;

    return (
        <Box 
            sx={{ 
                width: isCollapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH, 
                transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)', 
                flexShrink: 0,
                position: 'relative'
            }}
            onMouseEnter={() => { if (isCollapsed) setIsHovered(true); }}
            onMouseLeave={() => { if (isCollapsed) setIsHovered(false); }}
        >
            <Drawer
                variant="permanent"
                sx={{
                    width: currentWidth,
                    flexShrink: 0,
                    [`& .MuiDrawer-paper`]: { 
                        width: currentWidth, 
                        boxSizing: 'border-box',
                        transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s ease',
                        boxShadow: (isCollapsed && isHovered) ? '4px 0 20px rgba(0, 0, 0, 0.15)' : 'none',
                        overflowX: 'hidden',
                        zIndex: (isCollapsed && isHovered) ? 1200 : 1
                    },
                }}
            >
                {/* Header Logo & Collapse Toggle */}
                <Box sx={{ p: 2, pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                        <Box 
                            sx={{ 
                                width: 28, height: 28, borderRadius: 1.5, flexShrink: 0, mr: showFull ? 1.5 : 0,
                                background: 'linear-gradient(135deg, #37352F 0%, #73726E 100%)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: '#fff', fontSize: '14px', fontWeight: 'bold'
                            }}
                        >
                            C
                        </Box>
                        {showFull && (
                            <Typography variant="subtitle1" fontWeight="700" noWrap>
                                CeguyyyDrive
                            </Typography>
                        )}
                    </Box>

                    {showFull && (
                        <Tooltip title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
                            <IconButton 
                                size="small" 
                                onClick={() => { setIsCollapsed(!isCollapsed); setIsHovered(false); }}
                                sx={{ color: 'text.secondary' }}
                            >
                                {isCollapsed ? <ChevronRightIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
                            </IconButton>
                        </Tooltip>
                    )}
                </Box>
                
                {/* New Button */}
                <Box sx={{ px: showFull ? 2 : 1.5, pb: 2, pt: 1, display: 'flex', justifyContent: 'center' }}>
                    {showFull ? (
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
                    ) : (
                        <Tooltip title="New" placement="right">
                            <IconButton 
                                color="primary" 
                                onClick={handleMenuOpen}
                                sx={{ 
                                    bgcolor: 'action.hover',
                                    '&:hover': { bgcolor: 'action.selected' }
                                }}
                            >
                                <PlusIcon />
                            </IconButton>
                        </Tooltip>
                    )}

                    <Menu
                        anchorEl={anchorEl}
                        open={Boolean(anchorEl)}
                        onClose={handleMenuClose}
                        PaperProps={{ sx: { width: 220, mt: 0.5 } }}
                        elevation={2}
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
                
                {/* Navigation Links */}
                <List sx={{ flex: 1, pt: 0, px: showFull ? 2 : 1 }}>
                    {navItems.map((item) => {
                        const isMyDrive = item.path === '/drive';
                        const btnContent = (
                            <ListItemButton 
                                component={NavLink} 
                                to={item.path}
                                onDragOver={(e) => {
                                    if (isMyDrive) {
                                        e.preventDefault();
                                        if (!isMyDriveDragOver) setIsMyDriveDragOver(true);
                                    }
                                }}
                                onDragLeave={(e) => {
                                    if (isMyDrive) {
                                        e.preventDefault();
                                        setIsMyDriveDragOver(false);
                                    }
                                }}
                                onDrop={(e) => {
                                    if (!isMyDrive) return;
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setIsMyDriveDragOver(false);
                                    try {
                                        const dataString = e.dataTransfer.getData('application/json');
                                        if (!dataString) return;
                                        const data = JSON.parse(dataString);
                                        if (data.type === 'file') {
                                            moveFile.mutate({ id: data.id, targetFolderId: null });
                                        } else if (data.type === 'folder') {
                                            moveFolder.mutate({ id: data.id, targetFolderId: null });
                                        }
                                    } catch (err) {}
                                }}
                                sx={{ 
                                    py: 0.75, 
                                    px: showFull ? 1.5 : 0,
                                    justifyContent: showFull ? 'flex-start' : 'center',
                                    borderRadius: 1,
                                    border: isMyDrive && isMyDriveDragOver ? '2px dashed #1976d2' : '1px solid transparent',
                                    backgroundColor: isMyDrive && isMyDriveDragOver ? 'rgba(25, 118, 210, 0.12)' : undefined,
                                    '&.active': {
                                        backgroundColor: isMyDrive && isMyDriveDragOver ? 'rgba(25, 118, 210, 0.15)' : 'action.selected',
                                    },
                                    '& .MuiListItemIcon-root': { 
                                        minWidth: showFull ? 32 : 'auto',
                                        justifyContent: 'center',
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
                                {showFull && <ListItemText primary={item.name} />}
                            </ListItemButton>
                        );

                        return (
                            <ListItem key={item.name} disablePadding sx={{ mb: 0.5, display: 'block' }}>
                                {showFull ? (
                                    btnContent
                                ) : (
                                    <Tooltip title={item.name} placement="right">
                                        {btnContent}
                                    </Tooltip>
                                )}
                            </ListItem>
                        );
                    })}
                </List>

                {/* Storage & Profile Section */}
                <Box sx={{ p: showFull ? 2 : 1 }}>
                    {showFull ? (
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
                    ) : (
                        <Tooltip title={`Storage: ${formatBytes(totalMemory)} of 15 GB used`} placement="right">
                            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                                <CloudIcon sx={{ color: 'text.secondary' }} />
                            </Box>
                        </Tooltip>
                    )}

                    <Divider sx={{ mb: 2 }} />

                    {/* Profile */}
                    {showFull ? (
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
                    ) : (
                        <Tooltip title={user?.full_name || 'Profile'} placement="right">
                            <Box 
                                sx={{ display: 'flex', justifyContent: 'center', mb: 2, cursor: 'pointer' }}
                                onClick={() => setIsProfileModalOpen(true)}
                            >
                                <Avatar 
                                    src={user?.profile_picture_url} 
                                    sx={{ width: 32, height: 32, fontSize: '0.875rem' }}
                                >
                                    {user?.full_name?.charAt(0)?.toUpperCase()}
                                </Avatar>
                            </Box>
                        </Tooltip>
                    )}

                    {/* Sign Out */}
                    {showFull ? (
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
                    ) : (
                        <Tooltip title="Sign Out" placement="right">
                            <IconButton onClick={logout} sx={{ color: 'text.secondary', width: '100%' }}>
                                <LogoutIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    )}
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
        </Box>
    );
}
