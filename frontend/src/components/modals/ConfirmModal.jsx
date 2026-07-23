import React from 'react';
import { 
    Dialog, DialogTitle, DialogContent, DialogContentText, 
    DialogActions, Button 
} from '@mui/material';

export default function ConfirmModal({ 
    isOpen, 
    title = 'Confirm', 
    message = 'Are you sure?', 
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    onClose, 
    onConfirm,
    isDestructive = false,
    isPending = false
}) {
    return (
        <Dialog open={isOpen} onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle>{title}</DialogTitle>
            <DialogContent>
                <DialogContentText>{message}</DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={isPending} color="inherit">
                    {cancelText}
                </Button>
                <Button 
                    onClick={onConfirm} 
                    color={isDestructive ? "error" : "primary"} 
                    variant="contained"
                    disabled={isPending}
                >
                    {isPending ? 'Processing...' : confirmText}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
