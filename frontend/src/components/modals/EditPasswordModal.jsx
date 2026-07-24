import React, { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, TextField, Typography, Box, Alert, CircularProgress
} from '@mui/material';
import { Lock as LockIcon } from '@mui/icons-material';
import api from '../../services/api';

export default function EditPasswordModal({ isOpen, onClose, share, onSuccess }) {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        setPassword('');
        setError('');
    }, [share, isOpen]);

    const updatePasswordMutation = useMutation({
        mutationFn: async () => {
            const res = await api.patch(`/shares/${share.id}/password`, {
                password: password.trim()
            });
            return res.data;
        },
        onSuccess: () => {
            if (onSuccess) onSuccess();
            onClose();
        },
        onError: (err) => {
            setError(err.response?.data?.message || 'Failed to update share password');
        }
    });

    if (!isOpen || !share) return null;

    const hasExistingPassword = !!share.password_hash;
    const itemName = share.file_name || share.folder_name || 'shared item';

    return (
        <Dialog open={isOpen} onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
                <LockIcon color="warning" />
                {hasExistingPassword ? 'Change Password Protection' : 'Set Password Protection'}
            </DialogTitle>
            <DialogContent dividers>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Configure password access for <strong>"{itemName}"</strong>.
                    Leave blank to remove password protection.
                </Typography>

                <TextField
                    fullWidth
                    size="small"
                    type="password"
                    label="New Access Password"
                    placeholder="Leave blank to remove password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={updatePasswordMutation.isPending}>Cancel</Button>
                <Button
                    variant="contained"
                    onClick={() => updatePasswordMutation.mutate()}
                    disabled={updatePasswordMutation.isPending}
                    startIcon={updatePasswordMutation.isPending ? <CircularProgress size={16} color="inherit" /> : <LockIcon />}
                >
                    {updatePasswordMutation.isPending ? 'Saving...' : 'Save Password'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
