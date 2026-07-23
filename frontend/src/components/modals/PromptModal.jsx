import React, { useState, useEffect } from 'react';
import { 
    Dialog, DialogTitle, DialogContent, DialogContentText, 
    DialogActions, Button, TextField 
} from '@mui/material';

export default function PromptModal({ 
    isOpen, 
    title = 'Prompt', 
    message = 'Enter value:', 
    defaultValue = '',
    confirmText = 'OK',
    cancelText = 'Cancel',
    onClose, 
    onConfirm,
    isPending = false
}) {
    const [value, setValue] = useState(defaultValue);

    useEffect(() => {
        if (isOpen) {
            setValue(defaultValue);
        }
    }, [isOpen, defaultValue]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (value.trim()) {
            onConfirm(value.trim());
        }
    };

    return (
        <Dialog open={isOpen} onClose={onClose} maxWidth="xs" fullWidth>
            <form onSubmit={handleSubmit}>
                <DialogTitle>{title}</DialogTitle>
                <DialogContent>
                    {message && <DialogContentText sx={{ mb: 2 }}>{message}</DialogContentText>}
                    <TextField
                        autoFocus
                        fullWidth
                        size="small"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        disabled={isPending}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose} disabled={isPending} color="inherit">
                        {cancelText}
                    </Button>
                    <Button 
                        type="submit"
                        color="primary" 
                        variant="contained"
                        disabled={isPending || !value.trim()}
                    >
                        {isPending ? 'Processing...' : confirmText}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
}
