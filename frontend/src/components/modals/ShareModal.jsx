import React, { useState } from 'react';
import { 
    Dialog, DialogTitle, DialogContent, DialogActions, 
    Button, TextField, Typography, Box, Tabs, Tab, 
    CircularProgress, Alert, Select, MenuItem, FormControl, InputLabel
} from '@mui/material';
import { 
    Send as SendIcon, 
    ContentCopy as CopyIcon, 
    PersonAdd as PersonAddIcon, 
    Link as LinkIcon,
    AccessTime as TimeIcon
} from '@mui/icons-material';
import api from '../../services/api';

export default function ShareModal({ isOpen, onClose, itemType, itemId, itemName }) {
    const [tab, setTab] = useState(0); // 0: Share by Email, 1: Public Link
    
    // Email share state
    const [targetEmail, setTargetEmail] = useState('');
    const [emailLoading, setEmailLoading] = useState(false);
    const [emailSuccess, setEmailSuccess] = useState('');
    const [emailError, setEmailError] = useState('');

    // Public link state
    const [expirationOption, setExpirationOption] = useState('never'); // never, 1h, 1d, 7d, 30d
    const [linkLoading, setLinkLoading] = useState(false);
    const [publicLink, setPublicLink] = useState('');
    const [linkCopied, setLinkCopied] = useState(false);
    const [linkError, setLinkError] = useState('');

    const handleShareByEmail = async (e) => {
        e.preventDefault();
        if (!targetEmail || !targetEmail.trim()) return;

        setEmailLoading(true);
        setEmailSuccess('');
        setEmailError('');

        try {
            const payload = {
                targetEmail: targetEmail.trim(),
                ...(itemType === 'file' ? { fileId: itemId } : { folderId: itemId })
            };
            await api.post('/shares', payload);
            setEmailSuccess(`Successfully shared with ${targetEmail.trim()}! An inbox notification has been sent.`);
            setTargetEmail('');
        } catch (err) {
            setEmailError(err.response?.data?.message || 'Failed to share with user');
        } finally {
            setEmailLoading(false);
        }
    };

    const getExpirationDate = (option) => {
        if (option === 'never') return null;
        const now = new Date();
        if (option === '1h') now.setHours(now.getHours() + 1);
        else if (option === '1d') now.setDate(now.getDate() + 1);
        else if (option === '7d') now.setDate(now.getDate() + 7);
        else if (option === '30d') now.setDate(now.getDate() + 30);
        return now.toISOString();
    };

    const handleGeneratePublicLink = async () => {
        setLinkLoading(true);
        setLinkError('');
        setPublicLink('');

        try {
            const expiresAt = getExpirationDate(expirationOption);
            const payload = {
                expiresAt,
                ...(itemType === 'file' ? { fileId: itemId } : { folderId: itemId })
            };
            const res = await api.post('/shares', payload);
            const token = res.data.data.share.token;
            const link = `${window.location.origin}/s/${token}`;
            setPublicLink(link);
        } catch (err) {
            setLinkError(err.response?.data?.message || 'Failed to generate public link');
        } finally {
            setLinkLoading(false);
        }
    };

    const handleCopyLink = () => {
        if (!publicLink) return;
        navigator.clipboard.writeText(publicLink);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 3000);
    };

    return (
        <Dialog open={isOpen} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ fontWeight: 'bold', pb: 1 }}>
                Share "{itemName}"
            </DialogTitle>
            <DialogContent dividers>
                <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
                    <Tab icon={<PersonAddIcon fontSize="small" />} iconPosition="start" label="Share by Email" />
                    <Tab icon={<LinkIcon fontSize="small" />} iconPosition="start" label="Public Link Access" />
                </Tabs>

                {/* TAB 0: SHARE BY EMAIL */}
                {tab === 0 && (
                    <Box component="form" onSubmit={handleShareByEmail} sx={{ mt: 1 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Enter the email address of a registered user. They will receive an inbox notification and instant access in their <strong>Shared with me</strong> tab.
                        </Typography>

                        {emailSuccess && <Alert severity="success" sx={{ mb: 2 }}>{emailSuccess}</Alert>}
                        {emailError && <Alert severity="error" sx={{ mb: 2 }}>{emailError}</Alert>}

                        <TextField
                            fullWidth
                            size="small"
                            type="email"
                            label="User Email Address"
                            placeholder="e.g. friend@example.com"
                            value={targetEmail}
                            onChange={(e) => setTargetEmail(e.target.value)}
                            disabled={emailLoading}
                            required
                            sx={{ mb: 2 }}
                        />

                        <Button 
                            type="submit" 
                            variant="contained" 
                            startIcon={emailLoading ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
                            disabled={emailLoading || !targetEmail.trim()}
                        >
                            {emailLoading ? 'Sharing...' : 'Send Share & Notify'}
                        </Button>
                    </Box>
                )}

                {/* TAB 1: PUBLIC LINK ACCESS */}
                {tab === 1 && (
                    <Box sx={{ mt: 1 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Generate a shareable public link. Anyone with this link can view, preview, or copy the item to their Drive.
                        </Typography>

                        {linkError && <Alert severity="error" sx={{ mb: 2 }}>{linkError}</Alert>}

                        <Box sx={{ mb: 3 }}>
                            <FormControl fullWidth size="small">
                                <InputLabel id="expiration-label">Link Expiration Time</InputLabel>
                                <Select
                                    labelId="expiration-label"
                                    value={expirationOption}
                                    label="Link Expiration Time"
                                    onChange={(e) => {
                                        setExpirationOption(e.target.value);
                                        setPublicLink(''); // reset link when duration changes
                                    }}
                                    startAdornment={<TimeIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />}
                                >
                                    <MenuItem value="never">No Expiration (Permanent)</MenuItem>
                                    <MenuItem value="1h">1 Hour</MenuItem>
                                    <MenuItem value="1d">1 Day (24 Hours)</MenuItem>
                                    <MenuItem value="7d">7 Days</MenuItem>
                                    <MenuItem value="30d">30 Days</MenuItem>
                                </Select>
                            </FormControl>
                        </Box>

                        {publicLink ? (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                <Typography variant="caption" color="text.secondary" fontWeight="600">
                                    Your Public Link is ready:
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        value={publicLink}
                                        InputProps={{ readOnly: true }}
                                    />
                                    <Button 
                                        variant="contained" 
                                        startIcon={<CopyIcon />} 
                                        onClick={handleCopyLink}
                                        color={linkCopied ? 'success' : 'primary'}
                                        sx={{ minWidth: 100 }}
                                    >
                                        {linkCopied ? 'Copied!' : 'Copy'}
                                    </Button>
                                </Box>
                                <Typography variant="caption" color="success.main" fontWeight="500">
                                    ✓ Anyone with this link can access the item. Logged-in users can also save it to their Drive.
                                </Typography>
                            </Box>
                        ) : (
                            <Button 
                                variant="contained" 
                                onClick={handleGeneratePublicLink}
                                disabled={linkLoading}
                                startIcon={linkLoading ? <CircularProgress size={16} color="inherit" /> : <LinkIcon />}
                            >
                                {linkLoading ? 'Generating Link...' : 'Create Public Share Link'}
                            </Button>
                        )}
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Done</Button>
            </DialogActions>
        </Dialog>
    );
}
