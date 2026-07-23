import React, { useState, useEffect } from 'react';
import { 
    Dialog, DialogTitle, DialogContent, DialogActions, 
    IconButton, Typography, Box, CircularProgress, Button, Alert, Tooltip
} from '@mui/material';
import { Close as CloseIcon, Download as DownloadIcon } from '@mui/icons-material';
import api from '../../services/api';
import PromptModal from './PromptModal';
import DocViewer, { DocViewerRenderers } from "@cyntler/react-doc-viewer";
import "@cyntler/react-doc-viewer/dist/index.css";

export default function FilePreviewModal({ isOpen, onClose, file }) {
    const [previewUrl, setPreviewUrl] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isPromptOpen, setIsPromptOpen] = useState(false);

    useEffect(() => {
        let isMounted = true;
        if (isOpen && file) {
            setIsLoading(true);
            setError(null);
            api.get(`/storage/download-url/${file.id}`)
                .then(res => {
                    if (isMounted) setPreviewUrl(res.data.data.downloadUrl);
                })
                .catch(err => {
                    if (isMounted) setError(err.response?.data?.message || 'Failed to load preview');
                })
                .finally(() => {
                    if (isMounted) setIsLoading(false);
                });
        }
        return () => { isMounted = false; setPreviewUrl(null); };
    }, [isOpen, file]);

    if (!isOpen) return null;

    const mime = file?.mime_type || '';
    const isImage = mime.startsWith('image/');
    const isVideo = mime.startsWith('video/');
    const isAudio = mime.startsWith('audio/');
    const isPdf = mime === 'application/pdf';
    
    // Supported formats for DocViewer
    const isDocViewerSupported = [
        'text/', 'application/vnd.openxmlformats-officedocument', 'application/msword', 
        'application/vnd.ms-excel', 'application/vnd.ms-powerpoint'
    ].some(type => mime.startsWith(type));

    const triggerDownload = async (newName) => {
        setIsPromptOpen(false);
        try {
            const response = await fetch(previewUrl);
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
            alert("Failed to download file. It might be due to CORS restrictions or network issues.");
            window.open(previewUrl, '_blank');
        }
    };

    return (
        <Dialog 
            fullScreen 
            open={isOpen} 
            onClose={onClose} 
            sx={{ '& .MuiDialog-paper': { bgcolor: 'common.white' } }}
        >
            <DialogTitle sx={{ m: 0, p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'text.primary', bgcolor: 'grey.100' }}>
                <Typography variant="h6" noWrap sx={{ flex: 1, color: 'text.primary' }}>
                    {file.original_name || file.name}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title="Download">
                        <span>
                            <IconButton
                                aria-label="download"
                                onClick={() => setIsPromptOpen(true)}
                                disabled={!previewUrl}
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
            <DialogContent sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: isDocViewerSupported || isPdf ? 0 : 4, height: '100%', bgcolor: 'common.white', '& *': { minHeight: 0 } }}>
                <Box sx={{ width: '100%', height: '100%', display: 'flex', flex: 1, justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
                    {isLoading && <CircularProgress color="inherit" sx={{ color: 'common.white' }} />}
                    {error && <Alert severity="error">{error}</Alert>}
                    
                    {previewUrl && isImage && (
                        <Box component="img" src={previewUrl} alt={file.name} sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    )}

                    {previewUrl && isVideo && (
                        <Box component="video" controls src={previewUrl} sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    )}

                    {previewUrl && isAudio && (
                        <Box component="audio" controls src={previewUrl} sx={{ width: '100%', maxWidth: '400px', mx: 'auto' }} />
                    )}
                    
                    {previewUrl && isPdf && (
                        <Box component="iframe" src={`${previewUrl}#toolbar=0`} sx={{ width: '100%', height: '100%', border: 'none', bgcolor: 'background.paper' }} title={file.name} />
                    )}

                    {previewUrl && isDocViewerSupported && !isImage && !isPdf && (
                        <Box sx={{ 
                            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, bgcolor: 'common.white', overflow: 'hidden',
                            '& #react-doc-viewer': { height: '100% !important', width: '100% !important', display: 'flex', flexDirection: 'column' },
                            '& #react-doc-viewer > div': { flex: 1, height: '100% !important', width: '100% !important' },
                            '& iframe': { height: '100% !important', width: '100% !important', border: 'none', flex: 1 }
                        }}>
                            <DocViewer 
                                documents={[{ 
                                    uri: previewUrl, 
                                    fileName: file.original_name || file.name,
                                    fileType: (file.original_name || file.name).split('.').pop() 
                                }]} 
                                pluginRenderers={DocViewerRenderers}
                                style={{ width: '100%', height: '100%', backgroundColor: '#121212' }}
                                config={{
                                    header: {
                                        disableHeader: true
                                    }
                                }}
                            />
                        </Box>
                    )}
                    
                    {previewUrl && !isImage && !isPdf && !isVideo && !isAudio && !isDocViewerSupported && (
                        <Box sx={{ textAlign: 'center', color: 'common.white' }}>
                            <Typography variant="h6" gutterBottom>
                                Preview not available for this file type
                            </Typography>
                            <Button 
                                variant="contained" 
                                color="primary" 
                                onClick={() => setIsPromptOpen(true)}
                                sx={{ mt: 2 }}
                            >
                                Download File
                            </Button>
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
                defaultValue={file.original_name || file.name}
                confirmText="Download"
            />
        </Dialog>
    );
}
