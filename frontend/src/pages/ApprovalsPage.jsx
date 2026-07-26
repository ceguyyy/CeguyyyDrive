import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { 
    Box, Typography, Button, CircularProgress, Alert, Card, 
    CardContent, Stack, Chip, Tabs, Tab, Dialog, DialogTitle, 
    DialogContent, DialogActions, TextField, Tooltip, IconButton
} from '@mui/material';
import { 
    FactCheck as ApprovalIcon, 
    InsertDriveFile as FileIcon, 
    Folder as FolderIcon,
    CheckCircle as ApproveIcon,
    Cancel as RejectIcon,
    EditNote as RevisionIcon,
    Replay as ResubmitIcon,
    AccountTree as FlowIcon,
    Refresh as RefreshIcon,
    Visibility as PreviewIcon,
    Draw as DrawIcon,
    UploadFile as UploadIcon
} from '@mui/icons-material';
import api from '../services/api';
import ApprovalFlowVisualizer from '../components/approvals/ApprovalFlowVisualizer';
import { FilePreviewEmbed } from '@eternalheart/react-file-preview';
import '@eternalheart/react-file-preview/style.css';

const STATUS_LABEL = {
    approved: 'Approved ✓',
    rejected: 'Rejected ❌',
    needs_revision: 'Needs Revision ✏️',
    pending: 'Pending Sign-off ⏳'
};

const STATUS_COLOR = {
    approved: 'success',
    rejected: 'error',
    needs_revision: 'warning',
    pending: 'warning'
};

const NOTION_BADGE_STYLE = {
    approved: { bgcolor: '#EDF3EC', color: '#2B593F', border: '1px solid #D3E5D0' },
    rejected: { bgcolor: '#FDEBEC', color: '#9B2C2C', border: '1px solid #F8C9CB' },
    needs_revision: { bgcolor: '#FFF8E6', color: '#D9730D', border: '1px solid #F3E0AC' },
    pending: { bgcolor: '#F1F1EF', color: '#5A5A55', border: '1px solid #E3E2E0' }
};

export default function ApprovalsPage() {
    const navigate = useNavigate();
    const [tab, setTab] = useState(0); // 0: Pending My Sign-off, 1: My Requests
    const [selectedApprovalId, setSelectedApprovalId] = useState(null);
    const [decisionModal, setDecisionModal] = useState({ open: false, requestId: null, decision: 'approved' });
    const [comment, setComment] = useState('');
    const queryClient = useQueryClient();

    // Preview state
    const [previewModal, setPreviewModal] = useState({ open: false, requestId: null, title: '', url: null, loading: false, error: null });
    
    // Resubmit revised file state
    const [resubmitModal, setResubmitModal] = useState({ open: false, req: null });
    const [resubmitFile, setResubmitFile] = useState(null);
    const [resubmitUploading, setResubmitUploading] = useState(false);

    // E-signature state for decision modal
    const [sigTab, setSigTab] = useState(0); // 0: Draw Canvas, 1: Upload Image
    const [sigDataUrl, setSigDataUrl] = useState(null);
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);

    // Query 1: Fetch Pending Approvals for logged-in user
    const { data: pendingData, isLoading: isPendingLoading, refetch: refetchPending, isRefetching: isPendingRefetching } = useQuery({
        queryKey: ['approvals-pending'],
        queryFn: async () => {
            const res = await api.get('/approvals/pending');
            return res.data.data.pending;
        }
    });

    // Query 2: Fetch Submitted Requests created by user
    const { data: submittedData, isLoading: isSubmittedLoading, refetch: refetchSubmitted, isRefetching: isSubmittedRefetching } = useQuery({
        queryKey: ['approvals-submitted'],
        queryFn: async () => {
            const res = await api.get('/approvals/submitted');
            return res.data.data.submitted;
        }
    });

    // Query 3: Fetch details for selected approval request (for Visual Flow Modal)
    const { data: flowDetailsData } = useQuery({
        queryKey: ['approval-details', selectedApprovalId],
        queryFn: async () => {
            if (!selectedApprovalId) return null;
            const res = await api.get(`/approvals/${selectedApprovalId}`);
            return res.data.data;
        },
        enabled: !!selectedApprovalId
    });

    // Mutation: Process Approval Decision
    const resubmitMutation = useMutation({
        mutationFn: async ({ requestId, fileId }) => {
            const res = await api.post(`/approvals/${requestId}/resubmit`, { fileId });
            return res.data.data.request;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['approvals-submitted'] });
            queryClient.invalidateQueries({ queryKey: ['approvals-pending'] });
            queryClient.invalidateQueries({ queryKey: ['approval-details'] });
            setResubmitModal({ open: false, req: null });
            setResubmitFile(null);
        }
    });

    const decisionMutation = useMutation({
        mutationFn: async ({ requestId, decision, comment, signature }) => {
            const res = await api.post(`/approvals/${requestId}/decision`, { decision, comment, signature });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['approvals-pending'] });
            queryClient.invalidateQueries({ queryKey: ['approvals-submitted'] });
            queryClient.invalidateQueries({ queryKey: ['approval-details'] });
            setDecisionModal({ open: false, requestId: null, decision: 'approved' });
            setComment('');
            setSigDataUrl(null);
            setSigTab(0);
        }
    });

    const pendingRequests = pendingData || [];
    const submittedRequests = submittedData || [];

    const handleOpenDecision = (requestId, decision) => {
        setDecisionModal({ open: true, requestId, decision });
        setComment('');
        setSigDataUrl(null);
        setSigTab(0);
    };

    const handleConfirmDecision = () => {
        decisionMutation.mutate({
            requestId: decisionModal.requestId,
            decision: decisionModal.decision,
            comment: comment.trim(),
            signature: decisionModal.decision === 'approved' ? sigDataUrl : undefined
        });
    };

    const handleOpenPreview = async (req) => {
        const reqId = req.id || req.request_id || req.requestId;
        const fileIdParam = req.file_id || req.fileId;
        const titleToUse = req.title || req.file_name || req.current_file_name || 'Document.pdf';
        setPreviewModal({ open: true, requestId: reqId, title: titleToUse, url: null, loading: true, error: null });
        try {
            const queryParam = fileIdParam ? `?fileId=${fileIdParam}` : '';
            const res = await api.get(`/approvals/${reqId}/preview-url${queryParam}`);
            const rawUrl = res.data.data.url;
            let activeUrl = rawUrl;
            try {
                const fetchRes = await fetch(rawUrl);
                const blob = await fetchRes.blob();
                const pdfBlob = new Blob([blob], { type: 'application/pdf' });
                activeUrl = window.URL.createObjectURL(pdfBlob);
            } catch (blobErr) {
                console.warn('Blob fetch fallback to raw URL:', blobErr);
            }
            setPreviewModal(prev => ({ ...prev, url: activeUrl, loading: false }));
        } catch (err) {
            setPreviewModal(prev => ({ ...prev, loading: false, error: err.response?.data?.message || 'Failed to load PDF preview' }));
        }
    };

    const handleClosePreview = () => {
        if (previewModal.url && previewModal.url.startsWith('blob:')) {
            window.URL.revokeObjectURL(previewModal.url);
        }
        setPreviewModal({ open: false, requestId: null, title: '', url: null, loading: false, error: null });
    };

    const uploadResubmitFile = async () => {
        if (!resubmitFile || !resubmitModal.req) return;
        setResubmitUploading(true);
        try {
            let fileId = null;
            if (resubmitModal.req.folder_id && resubmitModal.req.organization_id) {
                const res = await api.post(`/organizations/${resubmitModal.req.organization_id}/drive/upload-url`, {
                    name: resubmitFile.name,
                    size: resubmitFile.size,
                    mimeType: resubmitFile.type || 'application/octet-stream',
                    folderId: resubmitModal.req.folder_id
                });
                const { uploadUrl, file } = res.data.data;
                await axios.put(uploadUrl, resubmitFile, {
                    headers: { 'Content-Type': resubmitFile.type || 'application/octet-stream' }
                });
                fileId = file.id;
            } else {
                const res = await api.post('/storage/upload-url', {
                    fileName: resubmitFile.name,
                    size: resubmitFile.size,
                    mimeType: resubmitFile.type || 'application/octet-stream',
                    folderId: resubmitModal.req.folder_id || null
                });
                const { uploadUrl, fileId: fId } = res.data.data;
                await axios.put(uploadUrl, resubmitFile, {
                    headers: { 'Content-Type': resubmitFile.type || 'application/octet-stream' }
                });
                fileId = fId;
            }
            await resubmitMutation.mutateAsync({ requestId: resubmitModal.req.id, fileId });
        } catch (err) {
            alert('Failed to upload revised file: ' + (err.response?.data?.message || err.message));
        } finally {
            setResubmitUploading(false);
        }
    };

    // Canvas drawing handlers
    const startDrawing = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        ctx.beginPath();
        ctx.moveTo(clientX - rect.left, clientY - rect.top);
        setIsDrawing(true);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#000080'; // professional navy ink
        ctx.lineTo(clientX - rect.left, clientY - rect.top);
        ctx.stroke();
        setSigDataUrl(canvas.toDataURL('image/png'));
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setSigDataUrl(null);
    };

    const isLoading = tab === 0 ? isPendingLoading : isSubmittedLoading;
    const isRefetching = tab === 0 ? isPendingRefetching : isSubmittedRefetching;

    const handleRefresh = () => {
        if (tab === 0) refetchPending();
        else refetchSubmitted();
    };

    const needsRevisionRequests = submittedRequests.filter(r => r.status === 'needs_revision');

    const renderSubmittedCard = (req) => (
        <Card key={req.id} variant="outlined" sx={{ 
            borderRadius: '8px', 
            border: '1px solid #E9E9E8', 
            bgcolor: '#FFFFFF', 
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
            transition: 'all 0.2s',
            '&:hover': { bgcolor: '#FBFBFA', borderColor: req.status === 'needs_revision' ? '#EAD59E' : '#D4D4D4' }
        }}>
            <CardContent sx={{ display: 'flex', flexDirection: 'column', p: 2.5, '&:last-child': { pb: 2.5 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: 2 }}>
                    {req.file_name ? (
                        <FileIcon sx={{ color: '#2E7D32', fontSize: 38, flexShrink: 0 }} />
                    ) : (
                        <FolderIcon sx={{ color: '#D9730D', fontSize: 38, flexShrink: 0 }} />
                    )}

                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#37352F', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }} noWrap>
                            {req.title}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                            <Chip label={`Org: ${req.organization_name}`} size="small" sx={{ bgcolor: '#F1F1EF', color: '#37352F', border: 'none', borderRadius: '4px', fontWeight: 500, height: '24px' }} />
                            <Chip
                                label={STATUS_LABEL[req.status] || 'Pending Sign-off ⏳'}
                                size="small"
                                sx={{ 
                                    ...(NOTION_BADGE_STYLE[req.status] || NOTION_BADGE_STYLE.pending),
                                    borderRadius: '4px',
                                    fontWeight: 600,
                                    height: '24px'
                                }}
                            />
                            <Typography variant="caption" sx={{ color: '#787774', ml: 0.5 }}>
                                • Submitted on {new Date(req.created_at).toLocaleDateString()}
                            </Typography>
                        </Box>
                    </Box>

                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', justifyContent: 'flex-end', flexShrink: 0, ml: 'auto' }}>
                        {req.file_name && (
                            <Button
                                variant="outlined"
                                size="small"
                                startIcon={<PreviewIcon />}
                                onClick={() => handleOpenPreview(req)}
                                sx={{ borderColor: '#E0E0E0', color: '#37352F', bgcolor: '#FFFFFF', borderRadius: '6px', textTransform: 'none', fontWeight: 500, '&:hover': { bgcolor: '#F1F1EF', borderColor: '#D4D4D4' } }}
                            >
                                Preview PDF
                            </Button>
                        )}
                        {req.status === 'needs_revision' && (
                            <Button
                                variant="contained"
                                size="small"
                                startIcon={<ResubmitIcon />}
                                onClick={() => { setResubmitModal({ open: true, req }); setResubmitFile(null); }}
                                sx={{ bgcolor: '#D9730D', color: '#FFFFFF', borderRadius: '6px', textTransform: 'none', fontWeight: 600, boxShadow: 'none', '&:hover': { bgcolor: '#C15F05', boxShadow: 'none' } }}
                            >
                                Upload Revision &amp; Resubmit
                            </Button>
                        )}
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<FlowIcon />}
                            onClick={() => setSelectedApprovalId(req.id)}
                            sx={{ borderColor: '#E0E0E0', color: '#37352F', bgcolor: '#FFFFFF', borderRadius: '6px', textTransform: 'none', fontWeight: 500, '&:hover': { bgcolor: '#F1F1EF', borderColor: '#D4D4D4' } }}
                        >
                            Visual Flow &amp; Timestamps
                        </Button>
                    </Box>
                </Box>

                {req.status === 'needs_revision' && (
                    <Box sx={{ mt: 2.5, pt: 2, borderTop: '1px solid #E9E9E8', width: '100%' }}>
                        <Box sx={{ 
                            p: 2, 
                            bgcolor: '#FFF8E6', 
                            border: '1px solid #F3E0AC', 
                            borderRadius: '6px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 1.5,
                            boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                        }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography sx={{ fontSize: '1.1rem' }}>💡</Typography>
                                    <Typography variant="subtitle2" sx={{ color: '#C15F05', fontWeight: 700, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
                                        Revision Requested by {req.revision_requested_by || 'Approver'} {req.revision_role_name ? `(${req.revision_role_name})` : ''}
                                    </Typography>
                                </Box>
                                <Chip 
                                    label={req.revision_policy === 'restart' ? 'Restart from Step 1' : `Resume at Step ${req.revision_step_number || 'Current'}`} 
                                    size="small" 
                                    sx={{ bgcolor: '#FCEFC7', color: '#8A4B06', fontWeight: 600, fontSize: '0.75rem', border: '1px solid #EAD59E', borderRadius: '4px', height: '22px' }} 
                                />
                            </Box>
                            
                            {req.revision_comment ? (
                                <Box sx={{ bgcolor: '#FFFFFF', p: 1.5, borderRadius: '4px', border: '1px solid #EAD59E', color: '#37352F', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', fontSize: '0.875rem', lineHeight: 1.5 }}>
                                    <Typography component="span" sx={{ fontWeight: 600, color: '#C15F05', mr: 0.5 }}>Comment:</Typography>
                                    "{req.revision_comment}"
                                </Box>
                            ) : (
                                <Typography variant="body2" sx={{ color: '#5A5A55', fontSize: '0.875rem' }}>
                                    Please review the document and upload a revised file to continue the approval workflow.
                                </Typography>
                            )}

                            <Typography variant="caption" sx={{ color: '#787774', display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.75rem' }}>
                                📌 Re-uploading your revised document will automatically replace the old file, convert to PDF if needed, and notify approvers to resume review.
                            </Typography>
                        </Box>
                    </Box>
                )}
            </CardContent>
        </Card>
    );

    return (
        <Box sx={{ pb: 6 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <ApprovalIcon color="primary" sx={{ fontSize: 32 }} />
                    <Typography color="text.primary" sx={{ fontSize: '1.25rem', fontWeight: 700 }}>
                        File Approvals Center
                    </Typography>
                    <Tooltip title="Refresh">
                        <span>
                            <IconButton size="small" onClick={handleRefresh} disabled={isRefetching}>
                                <RefreshIcon fontSize="small" sx={{ transform: isRefetching ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }} />
                            </IconButton>
                        </span>
                    </Tooltip>
                </Box>
                <Button
                    variant="outlined"
                    size="small"
                    startIcon={<FlowIcon />}
                    onClick={() => navigate('/organization')}
                >
                    Manage Templates
                </Button>
            </Box>

            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: '1px solid #EAEAEA' }}>
                <Tab icon={<ApprovalIcon fontSize="small" />} iconPosition="start" label={`Pending My Approval (${pendingRequests.length})`} />
                <Tab icon={<FlowIcon fontSize="small" />} iconPosition="start" label={`My Requests (${submittedRequests.length})`} />
                <Tab
                    icon={<RevisionIcon fontSize="small" />}
                    iconPosition="start"
                    label={`Needs Revision (${needsRevisionRequests.length})`}
                    sx={{
                        color: needsRevisionRequests.length > 0 ? '#D97706' : undefined,
                        fontWeight: needsRevisionRequests.length > 0 ? 'bold' : 'normal',
                        '&.Mui-selected': { color: '#D97706' }
                    }}
                />
            </Tabs>

            {isLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
                    <CircularProgress />
                </Box>
            ) : (
                <>
                    {/* TAB 0: PENDING MY SIGN-OFF */}
                    {tab === 0 && (
                        pendingRequests.length === 0 ? (
                            <Card variant="outlined" sx={{ p: 6, textAlign: 'center', borderRadius: '8px', bgcolor: '#FBFBFA', border: '1px solid #E9E9E8', boxShadow: 'none' }}>
                                <ApprovalIcon sx={{ fontSize: 56, color: '#9B9A97', mb: 1.5 }} />
                                <Typography variant="h6" sx={{ fontWeight: 600, color: '#37352F' }}>
                                    No Pending Approvals
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#787774' }}>
                                    You have no files or folders awaiting your sign-off at this time.
                                </Typography>
                            </Card>
                        ) : (
                            <Stack spacing={2.5}>
                                {pendingRequests.map(req => (
                                    <Card key={req.id} variant="outlined" sx={{ borderRadius: '8px', border: '1px solid #E9E9E8', bgcolor: '#FFFFFF', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)', transition: 'all 0.2s', '&:hover': { bgcolor: '#FBFBFA', borderColor: '#D4D4D4' } }}>
                                        <CardContent sx={{ display: 'flex', alignItems: 'center', p: 2.5, '&:last-child': { pb: 2.5 } }}>
                                            {req.file_name ? (
                                                <FileIcon sx={{ color: '#2E7D32', mr: 2, fontSize: 38 }} />
                                            ) : (
                                                <FolderIcon sx={{ color: '#D9730D', mr: 2, fontSize: 38 }} />
                                            )}

                                            <Box sx={{ flexGrow: 1, minWidth: 0, mr: 2 }}>
                                                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#37352F', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }} noWrap>
                                                    {req.title}
                                                </Typography>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                                                    <Chip label={`Org: ${req.organization_name}`} size="small" sx={{ bgcolor: '#F1F1EF', color: '#37352F', border: 'none', borderRadius: '4px', fontWeight: 500, height: '24px' }} />
                                                    <Chip label={`Requested by ${req.requester_name}`} size="small" sx={{ bgcolor: '#E7F3F8', color: '#186A9C', border: 'none', borderRadius: '4px', fontWeight: 500, height: '24px' }} />
                                                    <Chip label={`Step ${req.step_number}: ${req.role_name}`} size="small" sx={{ bgcolor: '#FFF8E6', color: '#D9730D', border: '1px solid #F3E0AC', borderRadius: '4px', fontWeight: 600, height: '24px' }} />
                                                    <Typography variant="caption" sx={{ color: '#787774', ml: 0.5 }}>
                                                        • Submitted on {new Date(req.created_at).toLocaleDateString()}
                                                    </Typography>
                                                </Box>
                                            </Box>

                                            <Stack direction="row" spacing={1}>
                                                {req.file_name && (
                                                    <Button
                                                        variant="outlined"
                                                        size="small"
                                                        startIcon={<PreviewIcon />}
                                                        onClick={() => handleOpenPreview(req)}
                                                        sx={{ borderColor: '#E0E0E0', color: '#37352F', bgcolor: '#FFFFFF', borderRadius: '6px', textTransform: 'none', fontWeight: 500, '&:hover': { bgcolor: '#F1F1EF', borderColor: '#D4D4D4' } }}
                                                    >
                                                        Preview PDF
                                                    </Button>
                                                )}
                                                <Button 
                                                    variant="outlined" 
                                                    size="small"
                                                    startIcon={<FlowIcon />}
                                                    onClick={() => setSelectedApprovalId(req.id)}
                                                    sx={{ borderColor: '#E0E0E0', color: '#37352F', bgcolor: '#FFFFFF', borderRadius: '6px', textTransform: 'none', fontWeight: 500, '&:hover': { bgcolor: '#F1F1EF', borderColor: '#D4D4D4' } }}
                                                >
                                                    Flow Visualizer
                                                </Button>
                                                <Button 
                                                    variant="contained" 
                                                    size="small"
                                                    startIcon={<ApproveIcon />}
                                                    onClick={() => handleOpenDecision(req.id, 'approved')}
                                                    sx={{ bgcolor: '#2E7D32', color: '#FFFFFF', borderRadius: '6px', textTransform: 'none', fontWeight: 600, boxShadow: 'none', '&:hover': { bgcolor: '#1B5E20', boxShadow: 'none' } }}
                                                >
                                                    Approve &amp; Sign
                                                </Button>
                                                <Button
                                                    variant="outlined"
                                                    size="small"
                                                    startIcon={<RevisionIcon />}
                                                    onClick={() => handleOpenDecision(req.id, 'needs_revision')}
                                                    sx={{ borderColor: '#F3E0AC', color: '#D9730D', bgcolor: '#FFF8E6', borderRadius: '6px', textTransform: 'none', fontWeight: 600, '&:hover': { bgcolor: '#FCEFC7', borderColor: '#EAD59E' } }}
                                                >
                                                    Request Revision
                                                </Button>
                                                <Button
                                                    variant="outlined"
                                                    size="small"
                                                    startIcon={<RejectIcon />}
                                                    onClick={() => handleOpenDecision(req.id, 'rejected')}
                                                    sx={{ borderColor: '#FCD5D6', color: '#C92A2A', bgcolor: '#FDEBEC', borderRadius: '6px', textTransform: 'none', fontWeight: 600, '&:hover': { bgcolor: '#F8D7DA', borderColor: '#F5C2C7' } }}
                                                >
                                                    Reject
                                                </Button>
                                            </Stack>
                                        </CardContent>
                                    </Card>
                                ))}
                            </Stack>
                        )
                    )}
                    {/* TAB 1: MY REQUESTS */}
                    {tab === 1 && (
                        submittedRequests.length === 0 ? (
                            <Card variant="outlined" sx={{ p: 6, textAlign: 'center', borderRadius: '8px', bgcolor: '#FBFBFA', border: '1px solid #E9E9E8', boxShadow: 'none' }}>
                                <FlowIcon sx={{ fontSize: 56, color: '#9B9A97', mb: 1.5 }} />
                                <Typography variant="h6" sx={{ fontWeight: 600, color: '#37352F' }}>
                                    No Approval Requests Submitted
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#787774' }}>
                                    When you submit a file or folder for approval, your requests will appear here.
                                </Typography>
                            </Card>
                        ) : (
                            <Stack spacing={2.5}>
                                {submittedRequests.map(req => renderSubmittedCard(req))}
                            </Stack>
                        )
                    )}

                    {/* TAB 2: NEEDS REVISION */}
                    {tab === 2 && (
                        needsRevisionRequests.length === 0 ? (
                            <Card variant="outlined" sx={{ p: 6, textAlign: 'center', borderRadius: '8px', bgcolor: '#FFF8E6', border: '1px solid #F3E0AC', boxShadow: 'none' }}>
                                <RevisionIcon sx={{ fontSize: 56, color: '#D9730D', mb: 1.5 }} />
                                <Typography variant="h6" sx={{ fontWeight: 600, color: '#37352F' }}>
                                    No Requests Needing Revision 🎉
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#787774' }}>
                                    Great job! You have no submitted files or folders that require changes or re-uploading at this time.
                                </Typography>
                            </Card>
                        ) : (
                            <Stack spacing={2.5}>
                                {needsRevisionRequests.map(req => renderSubmittedCard(req))}
                            </Stack>
                        )
                    )}
                </>
            )}

            {/* DECISION CONFIRMATION MODAL WITH E-SIGNATURE */}
            <Dialog open={decisionModal.open} onClose={() => setDecisionModal({ open: false, requestId: null, decision: 'approved' })} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ fontWeight: 'bold' }}>
                    {decisionModal.decision === 'approved' ? 'Approve & Digitally Sign Document'
                        : decisionModal.decision === 'needs_revision' ? 'Request Document Revision'
                        : 'Reject File Request'}
                </DialogTitle>
                <DialogContent dividers>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {decisionModal.decision === 'needs_revision'
                            ? 'Explain what needs changing. The requester will be required to upload a revised version.'
                            : 'Provide optional notes or feedback for this decision:'}
                    </Typography>
                    <TextField
                        fullWidth
                        multiline
                        rows={3}
                        size="small"
                        required={decisionModal.decision === 'needs_revision'}
                        error={decisionModal.decision === 'needs_revision' && !comment.trim()}
                        helperText={decisionModal.decision === 'needs_revision' && !comment.trim()
                            ? 'A comment is required when requesting a revision'
                            : ' '}
                        placeholder="Add comments..."
                        value={comment}
                        onChange={(e) => setComment(e.target.value)} 
                    />

                    {/* E-Signature Required for Approval */}
                    {decisionModal.decision === 'approved' && (
                        <Box sx={{ mt: 3, borderTop: '1px solid #eee', pt: 2 }}>
                            <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 0.5, display: 'flex', alignItems: 'center', gap: 1, color: 'primary.main' }}>
                                <DrawIcon fontSize="small" /> Required E-Signature &amp; Digital Watermark
                            </Typography>
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
                                By signing below, your digital signature and a security watermark will be permanently embedded into the PDF document.
                            </Typography>

                            <Tabs value={sigTab} onChange={(_, v) => setSigTab(v)} size="small" sx={{ mb: 1.5, minHeight: 36, '& .MuiTab-root': { minHeight: 36, py: 0.5 } }}>
                                <Tab label="Draw Signature" />
                                <Tab label="Upload Image" />
                            </Tabs>

                            {sigTab === 0 ? (
                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', bgcolor: '#fafafa', p: 1.5, borderRadius: 2, border: '1px solid #e0e0e0' }}>
                                    <canvas
                                        ref={canvasRef}
                                        width={420}
                                        height={150}
                                        onMouseDown={startDrawing}
                                        onMouseMove={draw}
                                        onMouseUp={stopDrawing}
                                        onMouseLeave={stopDrawing}
                                        onTouchStart={startDrawing}
                                        onTouchMove={draw}
                                        onTouchEnd={stopDrawing}
                                        style={{ border: '2px dashed #999', borderRadius: 8, cursor: 'crosshair', background: '#fff', touchAction: 'none', maxWidth: '100%' }}
                                    />
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: 420, maxWidth: '100%', mt: 1 }}>
                                        <Typography variant="caption" color="text.secondary">Use your mouse or touchscreen to sign</Typography>
                                        <Button size="small" color="error" onClick={clearCanvas}>Clear Canvas</Button>
                                    </Box>
                                </Box>
                            ) : (
                                <Box sx={{ border: '2px dashed #bbb', borderRadius: 2, p: 3, textAlign: 'center', background: '#fafafa' }}>
                                    <input
                                        type="file"
                                        accept="image/png, image/jpeg, image/jpg"
                                        id="sig-upload-input"
                                        style={{ display: 'none' }}
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                const reader = new FileReader();
                                                reader.onload = () => setSigDataUrl(reader.result);
                                                reader.readAsDataURL(file);
                                            }
                                        }}
                                    />
                                    <label htmlFor="sig-upload-input">
                                        <Button variant="outlined" component="span" size="small" startIcon={<UploadIcon />}>Select Signature Image</Button>
                                    </label>
                                    <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
                                        Supports PNG, JPG (transparent or white background recommended)
                                    </Typography>
                                    {sigDataUrl && (
                                        <Box sx={{ mt: 2, p: 1, border: '1px solid #ddd', borderRadius: 1, display: 'inline-block', bgcolor: '#fff' }}>
                                            <img src={sigDataUrl} alt="Signature Preview" style={{ maxHeight: 75, maxWidth: '100%' }} />
                                            <Box sx={{ mt: 0.5 }}>
                                                <Button size="small" color="error" onClick={() => setSigDataUrl(null)}>Remove</Button>
                                            </Box>
                                        </Box>
                                    )}
                                </Box>
                            )}
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDecisionModal({ open: false, requestId: null, decision: 'approved' })}>Cancel</Button>
                    <Button
                        variant="contained"
                        color={decisionModal.decision === 'approved' ? 'success'
                            : decisionModal.decision === 'needs_revision' ? 'warning'
                            : 'error'}
                        onClick={handleConfirmDecision}
                        disabled={decisionMutation.isPending
                            || (decisionModal.decision === 'needs_revision' && !comment.trim())
                            || (decisionModal.decision === 'approved' && !sigDataUrl)}
                    >
                        {decisionMutation.isPending ? 'Processing...' : `Confirm ${decisionModal.decision === 'approved' ? 'Approval & Sign' : decisionModal.decision === 'needs_revision' ? 'Revision Request' : 'Rejection'}`}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* RESUBMIT REVISED FILE MODAL */}
            <Dialog open={resubmitModal.open} onClose={() => { if (!resubmitUploading) { setResubmitModal({ open: false, req: null }); setResubmitFile(null); } }} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ fontWeight: 'bold' }}>
                    Upload Revised Document &amp; Resubmit
                </DialogTitle>
                <DialogContent dividers>
                    {resubmitModal.req && (
                        <Box sx={{ mb: 3, p: 2, bgcolor: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <RevisionIcon sx={{ color: '#D97706', fontSize: 20 }} />
                                    <Typography variant="subtitle2" sx={{ color: '#B45309', fontWeight: 'bold' }}>
                                        Requested by: {resubmitModal.req.revision_requested_by || 'Approver'} {resubmitModal.req.revision_role_name ? `(${resubmitModal.req.revision_role_name})` : ''}
                                    </Typography>
                                </Box>
                                <Chip 
                                    label={`Workflow Rule: ${resubmitModal.req.revision_policy === 'restart' ? 'Restart from Step 1' : `Resume at Step ${resubmitModal.req.revision_step_number || 'Current'}`}`} 
                                    size="small" 
                                    sx={{ bgcolor: '#FEF3C7', color: '#B45309', fontWeight: 'bold', fontSize: '0.75rem' }} 
                                />
                            </Box>
                            {resubmitModal.req.revision_comment && (
                                <Typography variant="body2" sx={{ color: '#78350F', fontStyle: 'italic', bgcolor: 'rgba(255,255,255,0.9)', p: 1.5, borderRadius: 1.5, borderLeft: '4px solid #D97706', my: 1.5, fontWeight: 'medium' }}>
                                    💬 "{resubmitModal.req.revision_comment}"
                                </Typography>
                            )}
                            <Typography variant="caption" sx={{ color: '#B45309', display: 'block', mt: 1 }}>
                                📌 Uploading a revised file will replace the current version, automatically convert to PDF if needed, and notify approvers to resume review.
                            </Typography>
                        </Box>
                    )}

                    <Box sx={{ border: '2px dashed #1976d2', borderRadius: 2, p: 4, textAlign: 'center', bgcolor: '#f4f9ff' }}>
                        <input
                            type="file"
                            id="resubmit-file-input"
                            style={{ display: 'none' }}
                            disabled={resubmitUploading}
                            onChange={(e) => setResubmitFile(e.target.files?.[0] || null)}
                        />
                        <label htmlFor="resubmit-file-input">
                            <Button variant="contained" component="span" startIcon={<UploadIcon />} disabled={resubmitUploading}>
                                Select Revised File
                            </Button>
                        </label>
                        {resubmitFile ? (
                            <Box sx={{ mt: 2, p: 1.5, bgcolor: '#fff', border: '1px solid #cce5ff', borderRadius: 1, display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                                <FileIcon color="primary" />
                                <Typography variant="body2" fontWeight="bold" noWrap sx={{ maxWidth: 260 }}>
                                    {resubmitFile.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    ({(resubmitFile.size / 1024).toFixed(1)} KB)
                                </Typography>
                            </Box>
                        ) : (
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                                No file selected yet. Supports PDF, PNG, JPG, or Text documents.
                            </Typography>
                        )}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => { setResubmitModal({ open: false, req: null }); setResubmitFile(null); }} disabled={resubmitUploading}>Cancel</Button>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={uploadResubmitFile}
                        disabled={!resubmitFile || resubmitUploading || resubmitMutation.isPending}
                        startIcon={resubmitUploading ? <CircularProgress size={18} color="inherit" /> : <ResubmitIcon />}
                    >
                        {resubmitUploading ? 'Uploading & Resubmitting...' : 'Upload & Resubmit'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* PDF PREVIEW MODAL */}
            <Dialog open={previewModal.open} onClose={handleClosePreview} maxWidth="lg" fullWidth>
                <DialogTitle sx={{ fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <FileIcon color="primary" />
                        <span>PDF Preview: {previewModal.title}</span>
                    </Box>
                    <Chip label="PDF Watermarked & Verified" color="primary" size="small" variant="outlined" />
                </DialogTitle>
                <DialogContent dividers sx={{ height: '75vh', p: 0, position: 'relative', bgcolor: '#ffffff' }}>
                    {previewModal.loading ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'text.secondary', gap: 2 }}>
                            <CircularProgress color="primary" />
                            <Typography>Loading document preview...</Typography>
                        </Box>
                    ) : previewModal.error ? (
                        <Box sx={{ p: 6, textAlign: 'center', color: 'text.primary' }}>
                            <Typography color="error" variant="h6" sx={{ mb: 1 }}>{previewModal.error}</Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>Please ensure the file exists in cloud storage and you have access.</Typography>
                        </Box>
                    ) : previewModal.url ? (
                        <Box sx={{ width: '100%', height: '100%', position: 'relative' }}>
                            <FilePreviewEmbed 
                                files={[{
                                    url: previewModal.url,
                                    name: previewModal.title || 'Document.pdf',
                                    fileType: (previewModal.title || '').includes('.') ? (previewModal.title || '').split('.').pop().toLowerCase() : 'pdf',
                                    size: 0
                                }]}
                                currentIndex={0}
                                showClose={false}
                                showDownload={false}
                                width="100%"
                                height="100%"
                                theme="light"
                                locale="en-US"
                                style={{ width: '100%', height: '100%' }}
                            />
                        </Box>
                    ) : null}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClosePreview}>Close Preview</Button>
                </DialogActions>
            </Dialog>

            {/* VISUAL FLOW DIAGRAM MODAL */}
            <Dialog open={!!selectedApprovalId} onClose={() => setSelectedApprovalId(null)} maxWidth="md" fullWidth>
                <DialogTitle sx={{ fontWeight: 'bold' }}>
                    Approval Flow Diagram &amp; Security Audit Log
                </DialogTitle>
                <DialogContent dividers>
                    {flowDetailsData ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <Typography variant="subtitle1" fontWeight="bold">
                                {flowDetailsData.request.title} ({flowDetailsData.request.organization_name})
                            </Typography>
                            <ApprovalFlowVisualizer approvalData={flowDetailsData} onPreview={handleOpenPreview} />
                        </Box>
                    ) : (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                            <CircularProgress />
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSelectedApprovalId(null)}>Close</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
