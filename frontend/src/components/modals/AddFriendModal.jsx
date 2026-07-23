import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, List, ListItem, ListItemAvatar, Avatar, ListItemText, CircularProgress, Typography, Box } from '@mui/material';
import { PersonAdd as PersonAddIcon } from '@mui/icons-material';
import api from '../../services/api';

export default function AddFriendModal({ isOpen, onClose, onStartChat }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [chatLoading, setChatLoading] = useState(null); // stores user id being processed

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setLoading(true);
        try {
            const res = await api.get(`/users/search?q=${encodeURIComponent(searchQuery)}`);
            setResults(res.data.data);
        } catch (err) {
            console.error('Failed to search users', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddAndChat = async (targetUser) => {
        setChatLoading(targetUser.id);
        // Close modal first so ChatInner (which has chat context) stays mounted
        onClose();
        // Then trigger the chat logic from the parent (ChatInner)
        if (onStartChat) {
            await onStartChat(targetUser);
        }
        setChatLoading(null);
    };

    return (
        <Dialog open={isOpen} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>Find Friends</DialogTitle>
            <DialogContent>
                <Box sx={{ display: 'flex', gap: 1, mt: 1, mb: 2 }}>
                    <TextField
                        fullWidth
                        size="small"
                        placeholder="Search by email or name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <Button variant="contained" onClick={handleSearch} disabled={loading}>
                        Search
                    </Button>
                </Box>

                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <List>
                        {results.length === 0 && searchQuery && (
                            <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 2 }}>
                                No users found
                            </Typography>
                        )}
                        {results.map((u) => (
                            <ListItem
                                key={u.id}
                                secondaryAction={
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        startIcon={chatLoading === u.id ? <CircularProgress size={14} /> : <PersonAddIcon />}
                                        onClick={() => handleAddAndChat(u)}
                                        disabled={chatLoading === u.id}
                                    >
                                        Add & Chat
                                    </Button>
                                }
                                sx={{ borderBottom: '1px solid #f0f0f0' }}
                            >
                                <ListItemAvatar>
                                    <Avatar src={u.profile_picture_url}>
                                        {u.full_name?.charAt(0).toUpperCase()}
                                    </Avatar>
                                </ListItemAvatar>
                                <ListItemText
                                    primary={u.full_name}
                                    secondary={u.email}
                                />
                            </ListItem>
                        ))}
                    </List>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="inherit">Close</Button>
            </DialogActions>
        </Dialog>
    );
}
