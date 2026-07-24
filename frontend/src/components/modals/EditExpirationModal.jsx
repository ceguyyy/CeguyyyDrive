import React, { useState } from 'react';
import { 
    Dialog, DialogTitle, DialogContent, DialogActions, 
    Button, Typography, Box, Select, MenuItem, FormControl, InputLabel, CircularProgress, Alert
} from '@mui/material';
import { AccessTime as TimeIcon } from '@mui/icons-material';
import api from '../../services/api';

export default function EditExpirationModal({ isOpen, onClose, share, onSuccess }) {
    const [expirationOption, setExpirationOption] = useState('never');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen || !share) return null;

    const getExpirationDate = (option) => {
        if (option === 'never') return null;
        const now = new Date();
        if (option === '1h') now.setHours(now.getHours() + 1);
        else if (option === '1d') now.setDate(now.getDate() + 1);
        else if (option === '7d') now.setDate(now.getDate() + 7);
        else if (option === '30d') now.setDate(now.getDate() + 30);
        return now.toISOString();
    };

    const handleSave = async () => {
        setIsLoading(true);
        setError('');
        try {
            const expiresAt = getExpirationDate(expirationOption);
            await api.patch(`/shares/${share.id}`, { expiresAt });
            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update link expiration');
        } finally {
            setIsLoading(false);
        }
    };

    const itemName = share.file_name || share.folder_name || 'Item';

    return (
        <Dialog open={isOpen} onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle sx={{ fontWeight: 'bold', pb: 1 }}>
                Edit Expiration - "{itemName}"
            </DialogTitle>
            <DialogContent dividers>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Update the expiration time for this share link.
                </Typography>

                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                <FormControl fullWidth size="small" sx={{ mt: 1 }}>
                    <InputLabel id="edit-expiration-label">New Expiration Time</InputLabel>
                    <Select
                        labelId="edit-expiration-label"
                        value={expirationOption}
                        label="New Expiration Time"
                        onChange={(e) => setExpirationOption(e.target.value)}
                        startAdornment={<TimeIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />}
                    >
                        <MenuItem value="never">No Expiration (Permanent)</MenuItem>
                        <MenuItem value="1h">1 Hour</MenuItem>
                        <MenuItem value="1d">1 Day (24 Hours)</MenuItem>
                        <MenuItem value="7d">7 Days</MenuItem>
                        <MenuItem value="30d">30 Days</MenuItem>
                    </Select>
                </FormControl>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={isLoading}>Cancel</Button>
                <Button 
                    variant="contained" 
                    onClick={handleSave} 
                    disabled={isLoading}
                    startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : <TimeIcon />}
                >
                    {isLoading ? 'Updating...' : 'Update Expiration'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
