import React, { useState, useEffect } from 'react';
import { 
    Dialog, DialogTitle, DialogContent, 
    IconButton, Typography, Box, CircularProgress, Tooltip
} from '@mui/material';
import { Close as CloseIcon, Download as DownloadIcon, OpenInNew as OpenInNewIcon } from '@mui/icons-material';
import api from '../../services/api';
import PromptModal from './PromptModal';
import { FilePreviewEmbed } from '@eternalheart/react-file-preview';
import '@eternalheart/react-file-preview/style.css';

export default function FilePreviewModal({ isOpen, onClose, file }) {
    const [previewUrl, setPreviewUrl] = useState(null);
    const [rawDownloadUrl, setRawDownloadUrl] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isPromptOpen, setIsPromptOpen] = useState(false);

    useEffect(() => {
        let isMounted = true;
        let activeBlobUrl = null;

        if (isOpen && file) {
            setIsLoading(true);
            setError(null);
            
            const targetId = file.id || file.file_id;
            api.get(`/storage/download-url/${targetId}`)
                .then(async res => {
                    if (!isMounted) return;
                    const url = res.data.data.downloadUrl;
                    setRawDownloadUrl(url);

                    const mime = file.mime_type || '';
                    const fileName = (file.original_name || file.name || '').toLowerCase();
                    const isPdf = mime === 'application/pdf' || mime.includes('pdf') || fileName.endsWith('.pdf');

                    if (isPdf) {
                        try {
                            const response = await fetch(url);
                            const blob = await response.blob();
                            const pdfBlob = new Blob([blob], { type: 'application/pdf' });
                            activeBlobUrl = window.URL.createObjectURL(pdfBlob);
                            if (isMounted) setPreviewUrl(activeBlobUrl);
                        } catch (err) {
                            if (isMounted) setPreviewUrl(url);
                        }
                    } else {
                        setPreviewUrl(url);
                    }
                })
                .catch(err => {
                    if (isMounted) setError(err.response?.data?.message || 'Failed to load preview');
                })
                .finally(() => {
                    if (isMounted) setIsLoading(false);
                });
        }

        return () => { 
            isMounted = false; 
            if (activeBlobUrl) window.URL.revokeObjectURL(activeBlobUrl);
            setPreviewUrl(null); 
            setRawDownloadUrl(null);
        };
    }, [isOpen, file]);

    if (!isOpen || !file) return null;

    const fileName = file.original_name || file.name || '';
    const fileExt = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';

    const previewFiles = previewUrl ? [{
        url: previewUrl,
        name: fileName,
        fileType: fileExt,
        size: file.size || 0
    }] : [];

    const triggerDownload = async (newName) => {
        setIsPromptOpen(false);
        const targetUrl = rawDownloadUrl || previewUrl;
        try {
            const response = await fetch(targetUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = newName;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            window.open(targetUrl, '_blank');
        }
    };

    return (
        <Dialog 
            fullScreen 
            open={isOpen} 
            onClose={onClose} 
            sx={{ 
                '& .MuiDialog-paper': { 
                    bgcolor: 'common.white',
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100vh',
                    maxHeight: '100vh',
                    overflow: 'hidden'
                } 
            }}
        >
            <DialogTitle sx={{ m: 0, p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'text.primary', bgcolor: 'grey.100', flexShrink: 0 }}>
                <Typography variant="h6" noWrap sx={{ flex: 1, color: 'text.primary' }}>
                    {fileName}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    {(rawDownloadUrl || previewUrl) && (
                        <Tooltip title="Open in new tab">
                            <IconButton
                                aria-label="open in new tab"
                                component="a"
                                href={rawDownloadUrl || previewUrl}
                                target="_blank"
                                rel="noreferrer"
                                sx={{ color: 'grey.700', '&:hover': { color: 'black' } }}
                            >
                                <OpenInNewIcon />
                            </IconButton>
                        </Tooltip>
                    )}
                    <Tooltip title="Download">
                        <span>
                            <IconButton
                                aria-label="download"
                                onClick={() => setIsPromptOpen(true)}
                                disabled={!previewUrl && !rawDownloadUrl}
                                sx={{ color: 'grey.700', '&:hover': { color: 'black' } }}
                            >
                                <DownloadIcon />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Tooltip title="Close">
                        <IconButton
                            aria-label="close"
                            onClick={onClose}
                            sx={{ color: 'grey.700', '&:hover': { color: 'black' } }}
                        >
                            <CloseIcon />
                        </IconButton>
                    </Tooltip>
                </Box>
            </DialogTitle>
            <DialogContent sx={{ display: 'flex', flexDirection: 'column', flex: 1, p: 0, height: 'calc(100vh - 64px)', width: '100%', bgcolor: '#ffffff', overflow: 'hidden', position: 'relative' }}>
                <Box sx={{ width: '100%', height: '100%', display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'center', alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
                    {isLoading && <CircularProgress color="primary" />}
                    {error && (
                        <Typography color="error" variant="body1" align="center" sx={{ p: 2 }}>
                            {error}
                        </Typography>
                    )}
                    
                    {!isLoading && previewUrl && (
                        <Box sx={{ width: '100%', height: '100%', flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
                            <FilePreviewEmbed 
                                files={previewFiles}
                                currentIndex={0}
                                showClose={false}
                                showDownload={false}
                                width="100%"
                                height="100%"
                                theme="light"
                                locale="en-US"
                                onDownload={() => setIsPromptOpen(true)}
                                style={{ width: '100%', height: '100%' }}
                            />
                        </Box>
                    )}
                </Box>
            </DialogContent>

            <PromptModal 
                isOpen={isPromptOpen}
                onClose={() => setIsPromptOpen(false)}
                onConfirm={triggerDownload}
                title="Download File"
                message="Enter a name for the downloaded file:"
                defaultValue={fileName}
                confirmText="Download"
            />
        </Dialog>
    );
}
