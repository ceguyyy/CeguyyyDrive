import React, { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
    AppBar, Toolbar, InputBase, Avatar, Box, IconButton, 
    Badge, Popover, Typography, List, ListItem, ListItemButton, LinearProgress,
    Tabs, Tab, Button, Divider 
} from '@mui/material';
import { 
    Search as SearchIcon, 
    Notifications as NotificationsIcon, 
    CheckCircle as CheckCircleIcon, 
    Error as ErrorIcon,
    Group as SharedIcon,
    MarkEmailRead as MarkReadIcon
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { useUploadStore } from '../../store/uploadStore';
import api from '../../services/api';

const Search = styled('div')(({ theme }) => ({
  position: 'relative',
  borderRadius: 4,
  backgroundColor: '#FFFFFF',
  border: '1px solid #EAEAEA',
  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
  '&:hover': {
    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.08)',
  },
  marginRight: theme.spacing(2),
  marginLeft: 0,
  width: '100%',
  [theme.breakpoints.up('sm')]: {
    marginLeft: theme.spacing(2),
    width: 'auto',
  },
  transition: 'box-shadow 0.2s',
}));

const SearchIconWrapper = styled('div')(({ theme }) => ({
  padding: theme.spacing(0, 1.5),
  height: '100%',
  position: 'absolute',
  pointerEvents: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: theme.palette.text.secondary,
}));

const StyledInputBase = styled(InputBase)(({ theme }) => ({
  color: 'inherit',
  width: '100%',
  '& .MuiInputBase-input': {
    padding: theme.spacing(1, 1, 1, 0),
    paddingLeft: `calc(1em + ${theme.spacing(3)})`,
    transition: theme.transitions.create('width'),
    width: '100%',
    fontSize: '0.875rem',
    [theme.breakpoints.up('md')]: {
      width: '40ch',
    },
  },
}));

export default function Header() {
    const user = useAuthStore(state => state.user);
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    
    // Uploads State
    const { uploads, removeUpload } = useUploadStore();
    const uploadList = Object.entries(uploads).reverse();
    const activeUploads = uploadList.filter(([, u]) => u.status === 'uploading').length;

    // Notifications Query
    const { data: notificationData } = useQuery({
        queryKey: ['notifications'],
        queryFn: async () => {
            const res = await api.get('/notifications');
            return res.data.data;
        },
        refetchInterval: 10000 // Polling every 10 seconds for real-time notifications
    });

    const notifications = notificationData?.notifications || [];
    const unreadCount = notificationData?.unreadCount || 0;
    const totalBadgeCount = activeUploads + unreadCount;

    const markAsReadMutation = useMutation({
        mutationFn: async (id) => {
            await api.put(`/notifications/${id}/read`);
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] })
    });

    const markAllReadMutation = useMutation({
        mutationFn: async () => {
            await api.put('/notifications/read-all');
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] })
    });

    const [popoverTab, setPopoverTab] = useState(0); // 0: Notifications, 1: Uploads
    const [anchorEl, setAnchorEl] = useState(null);
    const handleNotificationClick = (event) => setAnchorEl(event.currentTarget);
    const handleNotificationClose = () => setAnchorEl(null);
    const open = Boolean(anchorEl);

    const handleSearch = (e) => {
        const query = e.target.value;
        if (query) {
            setSearchParams({ q: query });
        } else {
            searchParams.delete('q');
            setSearchParams(searchParams);
        }
    };

    const handleNotificationItemClick = (notif) => {
        if (!notif.is_read) {
            markAsReadMutation.mutate(notif.id);
        }
        if (notif.link) {
            navigate(notif.link);
            handleNotificationClose();
        }
    };

    return (
        <AppBar position="static" color="inherit" elevation={0} sx={{ borderBottom: '1px solid #EAEAEA' }}>
            <Toolbar sx={{ minHeight: '60px !important' }}>
                <Search>
                    <SearchIconWrapper>
                        <SearchIcon fontSize="small" />
                    </SearchIconWrapper>
                    <StyledInputBase
                        placeholder="Search..."
                        inputProps={{ 'aria-label': 'search' }}
                        value={searchParams.get('q') || ''}
                        onChange={handleSearch}
                    />
                </Search>
                <Box sx={{ flexGrow: 1 }} />
                
                <IconButton color="inherit" onClick={handleNotificationClick} sx={{ mr: 2, color: 'text.secondary' }}>
                    <Badge badgeContent={totalBadgeCount} color="primary">
                        <NotificationsIcon />
                    </Badge>
                </IconButton>
                
                <Popover
                    open={open}
                    anchorEl={anchorEl}
                    onClose={handleNotificationClose}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                >
                    <Box sx={{ width: 360, maxHeight: 440, display: 'flex', flexDirection: 'column' }}>
                        <Tabs value={popoverTab} onChange={(_, v) => setPopoverTab(v)} variant="fullWidth" sx={{ borderBottom: '1px solid #EAEAEA' }}>
                            <Tab label={`Inbox (${unreadCount})`} />
                            <Tab label={`Uploads (${uploadList.length})`} />
                        </Tabs>

                        <Box sx={{ p: 2, flex: 1, overflowY: 'auto' }}>
                            {popoverTab === 0 && (
                                <>
                                    {unreadCount > 0 && (
                                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
                                            <Button size="small" startIcon={<MarkReadIcon fontSize="small" />} onClick={() => markAllReadMutation.mutate()}>
                                                Mark all read
                                            </Button>
                                        </Box>
                                    )}

                                    {notifications.length === 0 ? (
                                        <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ py: 3 }}>
                                            No inbox notifications
                                        </Typography>
                                    ) : (
                                        <List disablePadding>
                                            {notifications.map(n => (
                                                <ListItemButton
                                                    key={n.id}
                                                    onClick={() => handleNotificationItemClick(n)}
                                                    sx={{ 
                                                        mb: 1, borderRadius: 1.5, 
                                                        bgcolor: n.is_read ? 'transparent' : 'rgba(25, 118, 210, 0.06)',
                                                        border: n.is_read ? '1px solid #EAEAEA' : '1px solid #1976d2',
                                                        display: 'flex', alignItems: 'flex-start', p: 1.25
                                                    }}
                                                >
                                                    <SharedIcon sx={{ color: 'primary.main', mr: 1.5, mt: 0.25 }} fontSize="small" />
                                                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                                        <Typography variant="body2" fontWeight={n.is_read ? 500 : 700} noWrap>
                                                            {n.title}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary" display="block" sx={{ my: 0.25 }}>
                                                            {n.message}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.disabled">
                                                            {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </Typography>
                                                    </Box>
                                                </ListItemButton>
                                            ))}
                                        </List>
                                    )}
                                </>
                            )}

                            {popoverTab === 1 && (
                                <>
                                    {uploadList.length === 0 ? (
                                        <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ py: 3 }}>
                                            No recent uploads
                                        </Typography>
                                    ) : (
                                        <List disablePadding>
                                            {uploadList.map(([id, upload]) => (
                                                <ListItem key={id} disablePadding sx={{ mb: 2, flexDirection: 'column', alignItems: 'stretch' }}>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                                                        <Typography variant="body2" noWrap sx={{ pr: 1, flexGrow: 1 }}>{upload.name}</Typography>
                                                        {upload.status === 'success' && <CheckCircleIcon color="success" fontSize="small" />}
                                                        {upload.status === 'error' && <ErrorIcon color="error" fontSize="small" />}
                                                        {upload.status === 'uploading' && <Typography variant="caption" fontWeight="bold">{upload.progress}%</Typography>}
                                                    </Box>
                                                    {upload.status === 'uploading' && (
                                                        <LinearProgress variant="determinate" value={upload.progress} sx={{ height: 4, borderRadius: 2 }} />
                                                    )}
                                                    {(upload.status === 'success' || upload.status === 'error') && (
                                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }} onClick={() => removeUpload(id)}>
                                                            Dismiss
                                                        </Typography>
                                                    )}
                                                </ListItem>
                                            ))}
                                        </List>
                                    )}
                                </>
                            )}
                        </Box>
                    </Box>
                </Popover>
            </Toolbar>
        </AppBar>
    );
}
