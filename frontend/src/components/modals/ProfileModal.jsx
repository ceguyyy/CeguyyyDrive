import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import api from '../../services/api';
import axios from 'axios';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, TextField, Box, Typography, Avatar, IconButton,
    CircularProgress, Snackbar, Alert, Divider,
    Select, MenuItem, FormControl
} from '@mui/material';
import {
    PhotoCamera as PhotoCameraIcon,
    Save as SaveIcon,
    Business as OrgIcon,
} from '@mui/icons-material';

export default function ProfileModal({ isOpen, onClose }) {
    const { user, fetchMe, activeOrgId, setActiveOrgId } = useAuthStore();
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const { data: orgsData } = useQuery({
        queryKey: ['organizations'],
        queryFn: async () => {
            const res = await api.get('/organizations');
            return res.data.data;
        },
        enabled: isOpen,
    });
    const userOrgs = orgsData?.organizations ?? [];

    const handleOrgSwitch = (value) => {
        setActiveOrgId(value === 'personal' ? null : value);
        queryClient.invalidateQueries();
    };
    
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [profilePictureUrl, setProfilePictureUrl] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    
    const [loadingProfile, setLoadingProfile] = useState(false);
    const [loadingPassword, setLoadingPassword] = useState(false);
    
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (user) {
            setFullName(user.full_name || '');
            setEmail(user.email || '');
            setProfilePictureUrl(user.profile_picture_url || '');
        }
    }, [user]);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedFile(file);
            setProfilePictureUrl(URL.createObjectURL(file));
        }
    };

    const handleSaveProfile = async () => {
        setLoadingProfile(true);
        try {
            let profilePictureKey = undefined;

            if (selectedFile) {
                // 1. Get presigned URL
                const { data: { data } } = await api.post('/storage/upload-profile-picture-url', {
                    fileName: selectedFile.name
                });
                
                // 2. Upload to COS
                await axios.put(data.uploadUrl, selectedFile, {
                    headers: {
                        'Content-Type': selectedFile.type || 'image/jpeg'
                    }
                });
                
                profilePictureKey = data.storageKey;
            }

            // Update profile
            await api.put('/users/profile', {
                fullName: fullName !== user.full_name ? fullName : undefined,
                email: email !== user.email ? email : undefined,
                profilePictureKey
            });

            await fetchMe();
            setSnackbar({ open: true, message: 'Profile updated successfully', severity: 'success' });
            setSelectedFile(null);
        } catch (err) {
            console.error(err);
            setSnackbar({ 
                open: true, 
                message: err.response?.data?.message || 'Failed to update profile', 
                severity: 'error' 
            });
        } finally {
            setLoadingProfile(false);
        }
    };

    // Closing first matters: the modal renders over the app, and leaving it open
    // would hide the page we just navigated to.
    const handleForgotPassword = () => {
        const address = (email || user?.email || '').trim();
        onClose();
        navigate(address ? `/forgot-password?email=${encodeURIComponent(address)}` : '/forgot-password');
    };

    const handleUpdatePassword = async () => {
        if (!currentPassword || !newPassword) {
            setSnackbar({ open: true, message: 'Please fill both password fields', severity: 'warning' });
            return;
        }

        if (newPassword.length < 8) {
            setSnackbar({ open: true, message: 'New password must be at least 8 characters', severity: 'warning' });
            return;
        }

        setLoadingPassword(true);
        try {
            await api.put('/users/password', {
                currentPassword,
                newPassword
            });
            setSnackbar({ open: true, message: 'Password updated successfully', severity: 'success' });
            setCurrentPassword('');
            setNewPassword('');
        } catch (err) {
            console.error(err);
            setSnackbar({ 
                open: true, 
                message: err.response?.data?.message || 'Failed to update password', 
                severity: 'error' 
            });
        } finally {
            setLoadingPassword(false);
        }
    };

    return (
        <Dialog open={isOpen} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ fontWeight: 'bold' }}>Profile Settings</DialogTitle>
            <DialogContent dividers>
                {/* Profile Picture & Info */}
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
                    <Box sx={{ position: 'relative' }}>
                        <Avatar 
                            src={profilePictureUrl} 
                            sx={{ width: 100, height: 100, mb: 2, fontSize: '2rem' }}
                        >
                            {user?.full_name?.charAt(0)?.toUpperCase()}
                        </Avatar>
                        <IconButton
                            color="primary"
                            aria-label="upload picture"
                            component="span"
                            sx={{ position: 'absolute', bottom: 10, right: -10, backgroundColor: 'background.paper', boxShadow: 1 }}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <PhotoCameraIcon />
                        </IconButton>
                    </Box>
                    <input
                        type="file"
                        hidden
                        ref={fileInputRef}
                        accept="image/*"
                        onChange={handleFileChange}
                    />
                    
                    <TextField
                        margin="dense"
                        label="Full Name"
                        type="text"
                        fullWidth
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        variant="outlined"
                        sx={{ mb: 2 }}
                    />
                    <TextField
                        margin="dense"
                        label="Email Address"
                        type="email"
                        fullWidth
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        variant="outlined"
                    />
                    
                    <Button 
                        variant="contained" 
                        fullWidth 
                        sx={{ mt: 2 }} 
                        startIcon={loadingProfile ? <CircularProgress size={20} /> : <SaveIcon />}
                        disabled={loadingProfile}
                        onClick={handleSaveProfile}
                    >
                        Save Profile
                    </Button>
                </Box>

                <Divider sx={{ my: 3 }} />

                {/* Active Organization */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    <OrgIcon fontSize="small" color="primary" />
                    <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 600 }}>
                        Active Organization
                    </Typography>
                </Box>
                <FormControl size="small" fullWidth>
                    <Select
                        value={activeOrgId || 'personal'}
                        onChange={(e) => handleOrgSwitch(e.target.value)}
                        displayEmpty
                    >
                        <MenuItem value="personal">Personal Drive</MenuItem>
                        {userOrgs.map(org => (
                            <MenuItem key={org.id} value={org.id}>
                                {org.name}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <Divider sx={{ my: 3 }} />
                
                {/* Password Change */}
                <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 600, mb: 2 }}>
                    Change Password
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <TextField
                        label="Current Password"
                        type="password"
                        fullWidth
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                    />
                    <TextField
                        label="New Password"
                        type="password"
                        fullWidth
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        helperText="Must be at least 8 characters"
                    />
                    <Button 
                        variant="outlined" 
                        fullWidth 
                        disabled={loadingPassword}
                        startIcon={loadingPassword && <CircularProgress size={20} />}
                        onClick={handleUpdatePassword}
                    >
                        Update Password
                    </Button>
                    {/* For someone who cannot supply their current password.
                        Prefills the address and lets them send the code from the
                        reset page, rather than firing an email off a stray click. */}
                    <Button
                        variant="text"
                        size="small"
                        sx={{ textTransform: 'none', alignSelf: 'center' }}
                        onClick={handleForgotPassword}
                    >
                        Forgot your current password?
                    </Button>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="inherit">Close</Button>
            </DialogActions>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert severity={snackbar.severity} sx={{ width: '100%' }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Dialog>
    );
}
