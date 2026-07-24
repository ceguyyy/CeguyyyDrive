import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
    AccountTree as FlowIcon,
    Refresh as RefreshIcon
} from '@mui/icons-material';
import api from '../services/api';
import ApprovalFlowVisualizer from '../components/approvals/ApprovalFlowVisualizer';

export default function ApprovalsPage() {
    const navigate = useNavigate();
    const [tab, setTab] = useState(0); // 0: Pending My Sign-off, 1: My Requests
    const [selectedApprovalId, setSelectedApprovalId] = useState(null);
    const [decisionModal, setDecisionModal] = useState({ open: false, requestId: null, decision: 'approved' });
    const [comment, setComment] = useState('');
    const queryClient = useQueryClient();

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
    const decisionMutation = useMutation({
        mutationFn: async ({ requestId, decision, comment }) => {
            const res = await api.post(`/approvals/${requestId}/decision`, { decision, comment });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['approvals-pending'] });
            queryClient.invalidateQueries({ queryKey: ['approvals-submitted'] });
            queryClient.invalidateQueries({ queryKey: ['approval-details'] });
            setDecisionModal({ open: false, requestId: null, decision: 'approved' });
            setComment('');
        }
    });

    const pendingRequests = pendingData || [];
    const submittedRequests = submittedData || [];

    const handleOpenDecision = (requestId, decision) => {
        setDecisionModal({ open: true, requestId, decision });
        setComment('');
    };

    const handleConfirmDecision = () => {
        decisionMutation.mutate({
            requestId: decisionModal.requestId,
            decision: decisionModal.decision,
            comment: comment.trim()
        });
    };

    const isLoading = tab === 0 ? isPendingLoading : isSubmittedLoading;
    const isRefetching = tab === 0 ? isPendingRefetching : isSubmittedRefetching;

    const handleRefresh = () => {
        if (tab === 0) refetchPending();
        else refetchSubmitted();
    };

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <ApprovalIcon color="primary" sx={{ fontSize: 32 }} />
                    <Typography color="text.primary" sx={{ fontSize: '1.25rem', fontWeight: 700 }}>
                        File Approvals Center
                    </Typography>
                    <Tooltip title="Refresh">
                        <IconButton size="small" onClick={handleRefresh} disabled={isRefetching}>
                            <RefreshIcon fontSize="small" sx={{ transform: isRefetching ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }} />
                        </IconButton>
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
                            <Card variant="outlined" sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
                                <ApprovalIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                                <Typography variant="h6" fontWeight="bold" color="text.secondary">
                                    No Pending Approvals
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    You have no files or folders awaiting your sign-off at this time.
                                </Typography>
                            </Card>
                        ) : (
                            <Stack spacing={2} sx={{ flex: 1, overflowY: 'auto', pb: 4 }}>
                                {pendingRequests.map(req => (
                                    <Card key={req.id} variant="outlined" sx={{ borderRadius: 3 }}>
                                        <CardContent sx={{ display: 'flex', alignItems: 'center', p: 2, '&:last-child': { pb: 2 } }}>
                                            {req.file_name ? (
                                                <FileIcon sx={{ color: 'primary.main', mr: 2, fontSize: 40 }} />
                                            ) : (
                                                <FolderIcon sx={{ color: 'warning.main', mr: 2, fontSize: 40 }} />
                                            )}

                                            <Box sx={{ flexGrow: 1, minWidth: 0, mr: 2 }}>
                                                <Typography variant="subtitle1" fontWeight="bold" noWrap>
                                                    {req.title}
                                                </Typography>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                                                    <Chip label={`Org: ${req.organization_name}`} size="small" variant="outlined" />
                                                    <Chip label={`Requested by ${req.requester_name}`} size="small" color="primary" variant="outlined" />
                                                    <Chip label={`Step ${req.step_number}: ${req.role_name}`} size="small" color="warning" />
                                                    <Typography variant="caption" color="text.secondary">
                                                        • Submitted on {new Date(req.created_at).toLocaleDateString()}
                                                    </Typography>
                                                </Box>
                                            </Box>

                                            <Stack direction="row" spacing={1}>
                                                <Button 
                                                    variant="outlined" 
                                                    size="small"
                                                    startIcon={<FlowIcon />}
                                                    onClick={() => setSelectedApprovalId(req.id)}
                                                >
                                                    Flow Visualizer
                                                </Button>
                                                <Button 
                                                    variant="contained" 
                                                    size="small"
                                                    color="success"
                                                    startIcon={<ApproveIcon />}
                                                    onClick={() => handleOpenDecision(req.id, 'approved')}
                                                >
                                                    Approve
                                                </Button>
                                                <Button 
                                                    variant="outlined" 
                                                    size="small"
                                                    color="error"
                                                    startIcon={<RejectIcon />}
                                                    onClick={() => handleOpenDecision(req.id, 'rejected')}
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

                    {/* TAB 1: MY SUBMITTED REQUESTS */}
                    {tab === 1 && (
                        submittedRequests.length === 0 ? (
                            <Card variant="outlined" sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
                                <FlowIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                                <Typography variant="h6" fontWeight="bold" color="text.secondary">
                                    No Approval Requests Submitted
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    When you submit a file or folder for approval, your requests will appear here.
                                </Typography>
                            </Card>
                        ) : (
                            <Stack spacing={2} sx={{ flex: 1, overflowY: 'auto', pb: 4 }}>
                                {submittedRequests.map(req => (
                                    <Card key={req.id} variant="outlined" sx={{ borderRadius: 3 }}>
                                        <CardContent sx={{ display: 'flex', alignItems: 'center', p: 2, '&:last-child': { pb: 2 } }}>
                                            {req.file_name ? (
                                                <FileIcon sx={{ color: 'primary.main', mr: 2, fontSize: 40 }} />
                                            ) : (
                                                <FolderIcon sx={{ color: 'warning.main', mr: 2, fontSize: 40 }} />
                                            )}

                                            <Box sx={{ flexGrow: 1, minWidth: 0, mr: 2 }}>
                                                <Typography variant="subtitle1" fontWeight="bold" noWrap>
                                                    {req.title}
                                                </Typography>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                                                    <Chip label={`Org: ${req.organization_name}`} size="small" variant="outlined" />
                                                    <Chip 
                                                        label={req.status === 'approved' ? 'Approved ✓' : req.status === 'rejected' ? 'Rejected ❌' : 'Pending Sign-off ⏳'} 
                                                        size="small" 
                                                        color={req.status === 'approved' ? 'success' : req.status === 'rejected' ? 'error' : 'warning'} 
                                                    />
                                                    <Typography variant="caption" color="text.secondary">
                                                        • Submitted on {new Date(req.created_at).toLocaleDateString()}
                                                    </Typography>
                                                </Box>
                                            </Box>

                                            <Button 
                                                variant="outlined" 
                                                size="small"
                                                startIcon={<FlowIcon />}
                                                onClick={() => setSelectedApprovalId(req.id)}
                                            >
                                                Visual Flow & Timestamps
                                            </Button>
                                        </CardContent>
                                    </Card>
                                ))}
                            </Stack>
                        )
                    )}
                </>
            )}

            {/* DECISION CONFIRMATION MODAL */}
            <Dialog open={decisionModal.open} onClose={() => setDecisionModal({ open: false, requestId: null, decision: 'approved' })} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ fontWeight: 'bold' }}>
                    {decisionModal.decision === 'approved' ? 'Approve File Request' : 'Reject File Request'}
                </DialogTitle>
                <DialogContent dividers>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Provide optional notes or feedback for this decision:
                    </Typography>
                    <TextField 
                        fullWidth 
                        multiline 
                        rows={3} 
                        size="small" 
                        placeholder="Add comments..." 
                        value={comment} 
                        onChange={(e) => setComment(e.target.value)} 
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDecisionModal({ open: false, requestId: null, decision: 'approved' })}>Cancel</Button>
                    <Button 
                        variant="contained" 
                        color={decisionModal.decision === 'approved' ? 'success' : 'error'} 
                        onClick={handleConfirmDecision}
                        disabled={decisionMutation.isPending}
                    >
                        Confirm {decisionModal.decision === 'approved' ? 'Approval' : 'Rejection'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* VISUAL FLOW DIAGRAM MODAL */}
            <Dialog open={!!selectedApprovalId} onClose={() => setSelectedApprovalId(null)} maxWidth="md" fullWidth>
                <DialogTitle sx={{ fontWeight: 'bold' }}>
                    Approval Flow Diagram & Security Audit Log
                </DialogTitle>
                <DialogContent dividers>
                    {flowDetailsData ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <Typography variant="subtitle1" fontWeight="bold">
                                {flowDetailsData.request.title} ({flowDetailsData.request.organization_name})
                            </Typography>
                            <ApprovalFlowVisualizer approvalData={flowDetailsData} />
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
