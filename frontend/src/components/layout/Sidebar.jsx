import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import CreateFolderModal from '../modals/CreateFolderModal';
import ProfileModal from '../modals/ProfileModal';
import RequestApprovalUploadModal from '../modals/RequestApprovalUploadModal';
import { useUpload } from '../../hooks/useUpload';
import { useItemActions } from '../../hooks/useItemActions';
import api from '../../services/api';
import { 
    Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, 
    Button, Box, Typography, Divider, Menu, MenuItem, Avatar, LinearProgress,
    IconButton, Tooltip, Collapse
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
    Business as OrgIcon,
    Star as StarIcon,
    Apartment as CompanyDriveIcon,
    AdminPanelSettings as BillingIcon,
    ExpandLess, ExpandMore
} from '@mui/icons-material';

import CloudLogo from '../ui/CloudLogo';
import { isSuperAdmin } from '../../utils/roles';

const EXPANDED_WIDTH = 260;
const COLLAPSED_WIDTH = 72;

export default function Sidebar() {
    const { logout, user, totalMemory, storageLimit, activeOrgId, profileModalOpen, openProfileModal, closeProfileModal } = useAuthStore();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [isCompanyDriveOpen, setIsCompanyDriveOpen] = useState(true);

    const [anchorEl, setAnchorEl] = useState(null);
    const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
    const [isRequestApprovalModalOpen, setIsRequestApprovalModalOpen] = useState(false);
    const [isMyDriveDragOver, setIsMyDriveDragOver] = useState(false);
    
    const fileInputRef = useRef(null);
    const location = useLocation();
    const folderMatch = location.pathname.match(/\/drive\/folders\/([a-zA-Z0-9-]+)/);
    const currentFolderId = folderMatch ? folderMatch[1] : 'root';
    
    const uploadMutation = useUpload(currentFolderId);
    const { moveFile, moveFolder } = useItemActions(currentFolderId);

    const { data: orgsData } = useQuery({
        queryKey: ['organizations'],
        queryFn: async () => {
            const res = await api.get('/organizations');
            return res.data.data;
        }
    });
    const orgs = orgsData?.organizations ?? [];

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

    // When activeOrgId is null it means "Personal Drive" — no fallback to first org
    const currentOrg = activeOrgId ? (orgs.find(o => o.id === activeOrgId) || null) : null;

    useEffect(() => {
        if (currentOrg && currentOrg.custom_app_title && currentOrg.custom_app_title.trim() !== '') {
            document.title = `${currentOrg.custom_app_title.trim()} - Cloud Storage`;
        } else {
            document.title = 'CeguyyyDrive - Enterprise Cloud Storage';
        }
    }, [currentOrg]);

    let TOTAL_STORAGE_LIMIT = storageLimit || 5 * 1024 * 1024 * 1024; // 5 GB default Free
    if (currentOrg) {
        if (currentOrg.role_name === 'Owner' || currentOrg.owner_id === user?.id || user?.role_name === 'owner') {
            TOTAL_STORAGE_LIMIT = parseInt(currentOrg.storage_limit_bytes || 5368709120, 10);
        } else {
            TOTAL_STORAGE_LIMIT = parseInt(currentOrg.member_storage_limit_bytes || 5368709120, 10);
        }
    }
    const storagePercentage = Math.min((totalMemory / TOTAL_STORAGE_LIMIT) * 100, 100) || 0;

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
                        {currentOrg && currentOrg.custom_logo_url && currentOrg.custom_logo_url.trim() !== '' ? (
                            <Avatar src={currentOrg.custom_logo_url.trim()} sx={{ width: 34, height: 34, mr: showFull ? 1.5 : 0, bgcolor: 'transparent', '& img': { objectFit: 'contain' } }} />
                        ) : (
                            <CloudLogo size={34} sx={{ mr: showFull ? 1.5 : 0 }} />
                        )}
                        {showFull && (
                            <Typography variant="subtitle1" fontWeight="700" noWrap>
                                {currentOrg && currentOrg.custom_app_title && currentOrg.custom_app_title.trim() !== '' ? currentOrg.custom_app_title.trim() : 'CeguyyyDrive'}
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
                        <Divider sx={{ my: 0.5 }} />
                        <MenuItem onClick={() => { setIsRequestApprovalModalOpen(true); handleMenuClose(); }}>
                            <ListItemIcon><ApprovalIcon fontSize="small" sx={{ color: 'primary.main' }} /></ListItemIcon>
                            <ListItemText sx={{ fontWeight: 600, color: 'primary.main' }}>Request To Approve</ListItemText>
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
                    {/* My Drive */}
                    <ListItem disablePadding sx={{ mb: 0.5, display: 'block' }}>
                        <ListItemButton 
                            component={NavLink} 
                            to="/drive"
                            onDragOver={(e) => {
                                e.preventDefault();
                                if (!isMyDriveDragOver) setIsMyDriveDragOver(true);
                            }}
                            onDragLeave={(e) => {
                                e.preventDefault();
                                setIsMyDriveDragOver(false);
                            }}
                            onDrop={(e) => {
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
                                py: 0.75, px: showFull ? 1.5 : 0, justifyContent: showFull ? 'flex-start' : 'center', borderRadius: 1,
                                border: isMyDriveDragOver ? '2px dashed #1976d2' : '1px solid transparent',
                                backgroundColor: isMyDriveDragOver ? 'rgba(25, 118, 210, 0.12)' : undefined,
                                '&.active': { backgroundColor: 'action.selected' },
                                '& .MuiListItemIcon-root': { minWidth: showFull ? 32 : 'auto', justifyContent: 'center', color: 'text.secondary' }
                            }}
                        >
                            <ListItemIcon><FolderIcon /></ListItemIcon>
                            {showFull && <ListItemText primary="My Drive" />}
                        </ListItemButton>
                    </ListItem>

                    {/* Company Drive (Collapsible) */}
                    <ListItem disablePadding sx={{ mb: 0.5, display: 'block' }}>
                        <ListItemButton
                            onClick={() => setIsCompanyDriveOpen(!isCompanyDriveOpen)}
                            sx={{
                                py: 0.75, px: showFull ? 1.5 : 0, justifyContent: showFull ? 'flex-start' : 'center', borderRadius: 1,
                                '& .MuiListItemIcon-root': { minWidth: showFull ? 32 : 'auto', justifyContent: 'center', color: 'text.secondary' }
                            }}
                        >
                            <ListItemIcon><CompanyDriveIcon /></ListItemIcon>
                            {showFull && <ListItemText primary="Company Drive" />}
                            {showFull && (isCompanyDriveOpen ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />)}
                        </ListItemButton>

                        {showFull && (
                            <Collapse in={isCompanyDriveOpen} timeout="auto" unmountOnExit>
                                <List component="div" disablePadding sx={{ pl: 2 }}>
                                    {orgs.map(org => (
                                        <ListItemButton
                                            key={org.id}
                                            component={NavLink}
                                            to={`/company-drive/${org.id}`}
                                            sx={{
                                                py: 0.5, px: 1.5, borderRadius: 1,
                                                '&.active': { backgroundColor: 'action.selected' },
                                                '& .MuiListItemText-primary': { fontSize: '0.8rem', fontWeight: 500 }
                                            }}
                                        >
                                            <ListItemIcon sx={{ minWidth: 24 }}><OrgIcon sx={{ fontSize: 16 }} /></ListItemIcon>
                                            <ListItemText primary={org.name} noWrap />
                                        </ListItemButton>
                                    ))}
                                    {orgs.length === 0 && (
                                        <Typography variant="caption" color="text.secondary" sx={{ px: 2, py: 0.5, display: 'block' }}>
                                            No organizations
                                        </Typography>
                                    )}
                                </List>
                            </Collapse>
                        )}
                    </ListItem>

                    {/* Starred */}
                    <ListItem disablePadding sx={{ mb: 0.5, display: 'block' }}>
                        <ListItemButton 
                            component={NavLink} 
                            to="/starred"
                            sx={{ 
                                py: 0.75, px: showFull ? 1.5 : 0, justifyContent: showFull ? 'flex-start' : 'center', borderRadius: 1,
                                '&.active': { backgroundColor: 'action.selected' },
                                '& .MuiListItemIcon-root': { minWidth: showFull ? 32 : 'auto', justifyContent: 'center', color: 'text.secondary' }
                            }}
                        >
                            <ListItemIcon><StarIcon sx={{ color: '#F59E0B' }} /></ListItemIcon>
                            {showFull && <ListItemText primary="Starred" />}
                        </ListItemButton>
                    </ListItem>

                    {/* Shared with me */}
                    <ListItem disablePadding sx={{ mb: 0.5, display: 'block' }}>
                        <ListItemButton 
                            component={NavLink} 
                            to="/shared"
                            sx={{ 
                                py: 0.75, px: showFull ? 1.5 : 0, justifyContent: showFull ? 'flex-start' : 'center', borderRadius: 1,
                                '&.active': { backgroundColor: 'action.selected' },
                                '& .MuiListItemIcon-root': { minWidth: showFull ? 32 : 'auto', justifyContent: 'center', color: 'text.secondary' }
                            }}
                        >
                            <ListItemIcon><UsersIcon /></ListItemIcon>
                            {showFull && <ListItemText primary="Shared with me" />}
                        </ListItemButton>
                    </ListItem>

                    {/* Approvals */}
                    <ListItem disablePadding sx={{ mb: 0.5, display: 'block' }}>
                        <ListItemButton 
                            component={NavLink} 
                            to="/approvals"
                            sx={{ 
                                py: 0.75, px: showFull ? 1.5 : 0, justifyContent: showFull ? 'flex-start' : 'center', borderRadius: 1,
                                '&.active': { backgroundColor: 'action.selected' },
                                '& .MuiListItemIcon-root': { minWidth: showFull ? 32 : 'auto', justifyContent: 'center', color: 'text.secondary' }
                            }}
                        >
                            <ListItemIcon><ApprovalIcon /></ListItemIcon>
                            {showFull && <ListItemText primary="Approvals" />}
                        </ListItemButton>
                    </ListItem>

                    {/* Organization */}
                    <ListItem disablePadding sx={{ mb: 0.5, display: 'block' }}>
                        <ListItemButton 
                            component={NavLink} 
                            to="/organization"
                            sx={{ 
                                py: 0.75, px: showFull ? 1.5 : 0, justifyContent: showFull ? 'flex-start' : 'center', borderRadius: 1,
                                '&.active': { backgroundColor: 'action.selected' },
                                '& .MuiListItemIcon-root': { minWidth: showFull ? 32 : 'auto', justifyContent: 'center', color: 'text.secondary' }
                            }}
                        >
                            <ListItemIcon><OrgIcon /></ListItemIcon>
                            {showFull && <ListItemText primary="Organization" />}
                        </ListItemButton>
                    </ListItem>

                    {/* Trash */}
                    <ListItem disablePadding sx={{ mb: 0.5, display: 'block' }}>
                        <ListItemButton 
                            component={NavLink} 
                            to="/trash"
                            sx={{ 
                                py: 0.75, px: showFull ? 1.5 : 0, justifyContent: showFull ? 'flex-start' : 'center', borderRadius: 1,
                                '&.active': { backgroundColor: 'action.selected' },
                                '& .MuiListItemIcon-root': { minWidth: showFull ? 32 : 'auto', justifyContent: 'center', color: 'text.secondary' }
                            }}
                        >
                            <ListItemIcon><TrashIcon /></ListItemIcon>
                            {showFull && <ListItemText primary="Trash" />}
                        </ListItemButton>
                    </ListItem>

                    {/* Chat */}
                    <ListItem disablePadding sx={{ mb: 0.5, display: 'block' }}>
                        <ListItemButton 
                            component={NavLink} 
                            to="/chat"
                            sx={{ 
                                py: 0.75, px: showFull ? 1.5 : 0, justifyContent: showFull ? 'flex-start' : 'center', borderRadius: 1,
                                '&.active': { backgroundColor: 'action.selected' },
                                '& .MuiListItemIcon-root': { minWidth: showFull ? 32 : 'auto', justifyContent: 'center', color: 'text.secondary' }
                            }}
                        >
                            <ListItemIcon><ChatIcon /></ListItemIcon>
                            {showFull && <ListItemText primary="Chat" />}
                        </ListItemButton>
                    </ListItem>

                    {/* Super Admin Billing Console */}
                    {isSuperAdmin(user) && (
                        <ListItem disablePadding sx={{ mb: 0.5, display: 'block' }}>
                            <ListItemButton 
                                component={NavLink} 
                                to="/billing"
                                sx={{ 
                                    py: 0.75, px: showFull ? 1.5 : 0, justifyContent: showFull ? 'flex-start' : 'center', borderRadius: 1,
                                    '&.active': { backgroundColor: 'action.selected' },
                                    '& .MuiListItemIcon-root': { minWidth: showFull ? 32 : 'auto', justifyContent: 'center', color: 'text.secondary' }
                                }}
                            >
                                <ListItemIcon><BillingIcon /></ListItemIcon>
                                {showFull && <ListItemText primary="Billing Console" />}
                            </ListItemButton>
                        </ListItem>
                    )}
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
                                {formatBytes(totalMemory)} of {formatBytes(TOTAL_STORAGE_LIMIT)} used
                            </Typography>
                        </Box>
                    ) : (
                        <Tooltip title={`Storage: ${formatBytes(totalMemory)} of ${formatBytes(TOTAL_STORAGE_LIMIT)} used`} placement="right">
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
                            onClick={openProfileModal}
                        >
                            <Avatar 
                                src={user?.profile_picture_url} 
                                sx={{ width: 32, height: 32, mr: 1.5, fontSize: '0.875rem', flexShrink: 0 }}
                            >
                                {user?.full_name?.charAt(0)?.toUpperCase()}
                            </Avatar>
                            <Box sx={{ overflow: 'hidden', minWidth: 0 }}>
                                <Typography variant="body2" fontWeight={600} noWrap>
                                    {user?.full_name || 'User'}
                                </Typography>
                                <Typography variant="caption" noWrap sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.3 }}>
                                    {currentOrg ? `${currentOrg.name} · ${currentOrg.role_name || 'Member'}` : 'Personal Drive'}
                                </Typography>
                            </Box>
                        </Box>
                    ) : (
                        <Tooltip title={`${user?.full_name || 'Profile'} · ${currentOrg ? `${currentOrg.name} (${currentOrg.role_name || 'Member'})` : 'Personal Drive'}`} placement="right">
                            <Box 
                                sx={{ display: 'flex', justifyContent: 'center', mb: 2, cursor: 'pointer' }}
                                onClick={openProfileModal}
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
                isOpen={profileModalOpen}
                onClose={closeProfileModal}
            />

            <RequestApprovalUploadModal
                isOpen={isRequestApprovalModalOpen}
                onClose={() => setIsRequestApprovalModalOpen(false)}
                folderId={currentFolderId}
            />
        </Box>
    );
}
