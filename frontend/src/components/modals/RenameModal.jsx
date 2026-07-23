import React, { useState, useEffect } from 'react';
import { 
    Dialog, DialogTitle, DialogContent, DialogActions, 
    Button, TextField 
} from '@mui/material';

export default function RenameModal({ isOpen, onClose, currentName, onSave }) {
    const [name, setName] = useState('');

    useEffect(() => {
        if (isOpen) setName(currentName);
    }, [isOpen, currentName]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (name.trim() && name !== currentName) {
            onSave(name.trim());
            onClose();
        }
    };

    return (
        <Dialog open={isOpen} onClose={onClose} fullWidth maxWidth="sm">
            <form onSubmit={handleSubmit}>
                <DialogTitle fontWeight="bold">Rename Item</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        id="name"
                        label="New Name"
                        type="text"
                        fullWidth
                        variant="outlined"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                </DialogContent>
                <DialogActions sx={{ p: 2, pt: 0 }}>
                    <Button onClick={onClose} color="inherit">
                        Cancel
                    </Button>
                    <Button 
                        type="submit" 
                        variant="contained" 
                        disabled={!name.trim() || name === currentName}
                    >
                        Save
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
}
