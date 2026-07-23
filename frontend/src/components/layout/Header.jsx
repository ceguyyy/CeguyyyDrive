import React, { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useSearchParams } from 'react-router-dom';
import { AppBar, Toolbar, InputBase, Avatar, Box, IconButton, Badge, Popover, Typography, List, ListItem, LinearProgress } from '@mui/material';
import { Search as SearchIcon, Notifications as NotificationsIcon, CheckCircle as CheckCircleIcon, Error as ErrorIcon } from '@mui/icons-material';
import { styled, alpha } from '@mui/material/styles';
import { useUploadStore } from '../../store/uploadStore';

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
    
    // Notifications State
    const { uploads, removeUpload } = useUploadStore();
    const uploadList = Object.entries(uploads).reverse(); // show newest first
    const activeUploads = uploadList.filter(([, u]) => u.status === 'uploading').length;

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
                    <Badge badgeContent={activeUploads} color="primary">
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
                    <Box sx={{ p: 2, width: 320, maxHeight: 400, overflowY: 'auto' }}>
                        <Typography variant="h6" sx={{ mb: 2, fontSize: '1rem', fontWeight: 'bold' }}>Upload Logs</Typography>
                        {uploadList.length === 0 ? (
                            <Typography variant="body2" color="text.secondary">No recent uploads</Typography>
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
                    </Box>
                </Popover>
            </Toolbar>
        </AppBar>
    );
}
