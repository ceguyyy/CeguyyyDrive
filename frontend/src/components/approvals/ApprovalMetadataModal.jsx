import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, Typography, Box, Chip, Avatar, Divider, CircularProgress, Stack
} from '@mui/material';
import {
    CheckCircle as CheckIcon,
    HourglassEmpty as PendingIcon,
    Cancel as CancelIcon,
    Send as SendIcon
} from '@mui/icons-material';
import api from '../../services/api';

function StatusChip({ status }) {
    if (status === 'submitted') {
        return <Chip icon={<SendIcon fontSize="small" />} label="Submitted" size="small" color="primary" variant="outlined" />;
    }
    if (status === 'approved') {
        return <Chip icon={<CheckIcon fontSize="small" />} label="Approved" size="small" color="success" />;
    }
    if (status === 'rejected') {
        return <Chip icon={<CancelIcon fontSize="small" />} label="Rejected" size="small" color="error" />;
    }
    if (status === 'queued') {
        return <Chip label="Queued" size="small" variant="outlined" />;
    }
    return <Chip icon={<PendingIcon fontSize="small" />} label="Pending" size="small" color="warning" variant="outlined" />;
}

function TimelineRow({ avatarUrl, name, roleLabel, status, timestamp, comment, isLast }) {
    return (
        <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Avatar src={avatarUrl} sx={{ width: 32, height: 32, fontSize: '0.85rem' }}>
                    {(name || 'U').charAt(0).toUpperCase()}
                </Avatar>
                {!isLast && <Box sx={{ flex: 1, width: '2px', bgcolor: '#E2E8F0', my: 0.5, minHeight: 16 }} />}
            </Box>
            <Box sx={{ pb: isLast ? 0 : 2.5, flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Typography variant="body2" fontWeight={700}>{name || 'Unassigned'}</Typography>
                    <Typography variant="caption" color="text.secondary">{roleLabel}</Typography>
                    <StatusChip status={status} />
                </Box>
                {timestamp && (
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
                        {new Date(timestamp).toLocaleString()}
                    </Typography>
                )}
                {comment && (
                    <Typography variant="caption" sx={{ display: 'block', mt: 0.5, fontStyle: 'italic', bgcolor: '#F8FAFC', p: 0.75, borderRadius: 1 }}>
                        "{comment}"
                    </Typography>
                )}
            </Box>
        </Box>
    );
}

export default function ApprovalMetadataModal({ isOpen, onClose, requestId }) {
    const { data, isLoading } = useQuery({
        queryKey: ['approval-details', requestId],
        queryFn: async () => {
            const res = await api.get(`/approvals/${requestId}`);
            return res.data.data;
        },
        enabled: isOpen && !!requestId
    });

    return (
        <Dialog open={isOpen} onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle sx={{ fontWeight: 'bold' }}>Approval Metadata</DialogTitle>
            <DialogContent dividers>
                {isLoading || !data ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                        <CircularProgress size={28} />
                    </Box>
                ) : (
                    <Stack spacing={2}>
                        <Box>
                            <Typography variant="subtitle1" fontWeight={700}>{data.request.title}</Typography>
                            <Typography variant="caption" color="text.secondary">
                                {data.request.organization_name}
                            </Typography>
                        </Box>

                        <Divider />

                        <Box>
                            <TimelineRow
                                avatarUrl={data.request.requester_avatar}
                                name={data.request.requester_name}
                                roleLabel="Requester"
                                status="submitted"
                                timestamp={data.request.created_at}
                                isLast={data.steps.length === 0}
                            />
                            {data.steps.map((st, idx) => (
                                <TimelineRow
                                    key={st.id}
                                    avatarUrl={st.approver_avatar}
                                    name={st.approver_name || `Any ${st.role_name}`}
                                    roleLabel={`Step ${st.step_number}: ${st.role_name}`}
                                    status={st.status}
                                    timestamp={st.action_timestamp}
                                    comment={st.comment}
                                    isLast={idx === data.steps.length - 1}
                                />
                            ))}
                        </Box>
                    </Stack>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Close</Button>
            </DialogActions>
        </Dialog>
    );
}
