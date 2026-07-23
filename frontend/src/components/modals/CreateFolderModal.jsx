import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { 
    Dialog, DialogTitle, DialogContent, DialogActions, 
    Button, TextField 
} from '@mui/material';

export default function CreateFolderModal({ isOpen, onClose, parentId = null }) {
    const [name, setName] = useState('');
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: async (folderName) => {
            const actualParentId = parentId === 'root' ? null : parentId;
            const res = await api.post('/folders', { name: folderName, parentId: actualParentId });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['folders', parentId ? parentId : 'root'] });
            setName('');
            onClose();
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (name.trim()) mutation.mutate(name.trim());
    };

    return (
        <Dialog open={isOpen} onClose={onClose} fullWidth maxWidth="sm">
            <form onSubmit={handleSubmit}>
                <DialogTitle fontWeight="bold">Create Folder</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        id="name"
                        label="Folder Name"
                        type="text"
                        fullWidth
                        variant="outlined"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Q3 Financials"
                    />
                </DialogContent>
                <DialogActions sx={{ p: 2, pt: 0 }}>
                    <Button onClick={onClose} color="inherit">
                        Cancel
                    </Button>
                    <Button 
                        type="submit" 
                        variant="contained" 
                        disabled={!name.trim() || mutation.isPending}
                    >
                        {mutation.isPending ? 'Creating...' : 'Create'}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
}
