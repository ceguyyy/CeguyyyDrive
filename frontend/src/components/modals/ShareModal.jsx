import React, { useState } from 'react';
import { 
    Dialog, DialogTitle, DialogContent, DialogActions, 
    Button, TextField, Typography, Box, Tabs, Tab, 
    InputAdornment, IconButton, Alert, CircularProgress,
    List, ListItem, ListItemText, ListItemSecondaryAction, Tooltip
} from '@mui/material';
import { 
    Send as SendIcon, 
    ContentCopy as CopyIcon, 
    PersonAdd as PersonAddIcon, 
    Link as LinkIcon,
    Delete as DeleteIcon
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

    const handleGeneratePublicLink = async () => {
        setLinkLoading(true);
        setLinkError('');
        setPublicLink('');

        try {
            const payload = {
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
                    <Tab icon={<LinkIcon fontSize="small" />} iconPosition="start" label="Public Link" />
                </Tabs>

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

                {tab === 1 && (
                    <Box sx={{ mt: 1 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Generate a shareable public link. Anyone with this link can view or download the item.
                        </Typography>

                        {linkError && <Alert severity="error" sx={{ mb: 2 }}>{linkError}</Alert>}

                        {publicLink ? (
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
                                >
                                    {linkCopied ? 'Copied!' : 'Copy'}
                                </Button>
                            </Box>
                        ) : (
                            <Button 
                                variant="outlined" 
                                onClick={handleGeneratePublicLink}
                                disabled={linkLoading}
                                startIcon={linkLoading ? <CircularProgress size={16} /> : <LinkIcon />}
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
