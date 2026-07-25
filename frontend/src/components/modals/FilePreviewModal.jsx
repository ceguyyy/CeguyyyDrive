import React, { useState, useEffect } from 'react';
import { 
    Dialog, DialogTitle, DialogContent, 
    IconButton, Typography, Box, CircularProgress, Button, Alert, Tooltip
} from '@mui/material';
import { Close as CloseIcon, Download as DownloadIcon, OpenInNew as OpenInNewIcon } from '@mui/icons-material';
import api from '../../services/api';
import PromptModal from './PromptModal';
import DocViewer, { DocViewerRenderers } from "@cyntler/react-doc-viewer";
import "@cyntler/react-doc-viewer/dist/index.css";

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
                            // Fetch as blob to guarantee 100% inline PDF preview without browser auto-downloading
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

    const mime = file.mime_type || '';
    const fileName = (file.original_name || file.name || '').toLowerCase();
    const isImage = mime.startsWith('image/');
    const isVideo = mime.startsWith('video/');
    const isAudio = mime.startsWith('audio/');
    const isPdf = mime === 'application/pdf' || mime.includes('pdf') || fileName.endsWith('.pdf');
    
    const isOfficeDoc = ['xlsx', 'xls', 'docx', 'doc', 'pptx', 'ppt', 'csv'].some(ext => fileName.endsWith('.' + ext)) ||
        ['spreadsheet', 'wordprocessing', 'presentation', 'msword', 'ms-excel', 'ms-powerpoint'].some(t => mime.includes(t));

    // Supported formats for DocViewer
    const isDocViewerSupported = isOfficeDoc || [
        'text/', 'application/vnd.openxmlformats-officedocument', 'application/msword', 
        'application/vnd.ms-excel', 'application/vnd.ms-powerpoint'
    ].some(type => mime.startsWith(type));

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
            sx={{ '& .MuiDialog-paper': { bgcolor: 'common.white' } }}
        >
            <DialogTitle sx={{ m: 0, p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'text.primary', bgcolor: 'grey.100' }}>
                <Typography variant="h6" noWrap sx={{ flex: 1, color: 'text.primary' }}>
                    {file.original_name || file.name}
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
            <DialogContent sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', p: isDocViewerSupported || isPdf ? 0 : 4, height: '100%', width: '100%', bgcolor: 'common.white', overflow: 'hidden' }}>
                <Box sx={{ width: '100%', height: '100%', display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
                    {isLoading && <CircularProgress color="primary" />}
                    {error && <Alert severity="error">{error}</Alert>}
                    
                    {!isLoading && previewUrl && isImage && (
                        <Box component="img" src={previewUrl} alt={file.name} sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    )}

                    {!isLoading && previewUrl && isVideo && (
                        <Box component="video" controls src={previewUrl} sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    )}

                    {!isLoading && previewUrl && isAudio && (
                        <Box component="audio" controls src={previewUrl} sx={{ width: '100%', maxWidth: '400px', mx: 'auto' }} />
                    )}
                    
                    {!isLoading && previewUrl && isPdf && (
                        <Box sx={{ width: '100%', height: '100%', bgcolor: '#525659' }}>
                            <object
                                data={previewUrl}
                                type="application/pdf"
                                width="100%"
                                height="100%"
                                style={{ border: 'none' }}
                            >
                                <iframe 
                                    src={previewUrl} 
                                    style={{ width: '100%', height: '100%', border: 'none' }} 
                                    title={file.name}
                                >
                                    <p style={{ color: 'white', padding: '16px' }}>
                                        Your browser does not support inline PDF rendering.{' '}
                                        <a href={rawDownloadUrl || previewUrl} target="_blank" rel="noreferrer" style={{ color: '#90caf9' }}>
                                            Click here to open PDF directly
                                        </a>.
                                    </p>
                                </iframe>
                            </object>
                        </Box>
                    )}

                    {!isLoading && previewUrl && isOfficeDoc && !isImage && !isPdf && (
                        <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', flex: 1, bgcolor: '#ffffff' }}>
                            <iframe 
                                src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(previewUrl)}`}
                                title={file.original_name || file.name}
                                width="100%"
                                height="100%"
                                style={{ border: 'none', flex: 1, minHeight: '100%' }}
                            />
                        </Box>
                    )}

                    {!isLoading && previewUrl && isDocViewerSupported && !isOfficeDoc && !isImage && !isPdf && (
                        <Box sx={{ 
                            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', bgcolor: 'common.white', overflow: 'hidden',
                            '& #react-doc-viewer, & #react-doc-viewer *, & #ms-doc-renderer, & #ms-doc-iframe, & iframe': { 
                                height: '100% !important', width: '100% !important', minHeight: '100% !important', border: 'none !important', flex: '1 1 auto !important', display: 'flex !important', flexDirection: 'column !important' 
                            }
                        }}>
                            <DocViewer 
                                documents={[{ 
                                    uri: previewUrl, 
                                    fileName: file.original_name || file.name,
                                    fileType: (file.original_name || file.name).split('.').pop() 
                                }]} 
                                pluginRenderers={DocViewerRenderers}
                                style={{ width: '100%', height: '100%', backgroundColor: '#ffffff' }}
                                config={{
                                    header: {
                                        disableHeader: true
                                    }
                                }}
                            />
                        </Box>
                    )}
                    
                    {!isLoading && previewUrl && !isImage && !isPdf && !isVideo && !isAudio && !isDocViewerSupported && (
                        <Box sx={{ textAlign: 'center', color: 'text.primary' }}>
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
