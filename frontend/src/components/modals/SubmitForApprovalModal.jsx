import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
    Dialog, DialogTitle, DialogContent, DialogActions, 
    Button, Typography, Box, TextField, Select, MenuItem, 
    FormControl, InputLabel, CircularProgress, Alert, Stack, Chip, Paper
} from '@mui/material';
import { 
    FactCheck as ApprovalIcon, 
    Add as AddIcon,
    Delete as DeleteIcon
} from '@mui/icons-material';
import api from '../../services/api';

export default function SubmitForApprovalModal({ isOpen, onClose, isFile, item }) {
    const [selectedOrgId, setSelectedOrgId] = useState('');
    const [title, setTitle] = useState('');
    const [steps, setSteps] = useState([{ role_name: 'Manager', approver_id: '' }]);
    const [error, setError] = useState('');
    const queryClient = useQueryClient();

    const { data: orgsData } = useQuery({
        queryKey: ['organizations'],
        queryFn: async () => {
            const res = await api.get('/organizations');
            const orgs = res.data.data.organizations;
            if (orgs.length > 0 && !selectedOrgId) {
                setSelectedOrgId(orgs[0].id);
            }
            return orgs;
        },
        enabled: isOpen
    });

    const { data: rolesData } = useQuery({
        queryKey: ['org-roles', selectedOrgId],
        queryFn: async () => {
            if (!selectedOrgId) return [];
            const res = await api.get(`/organizations/${selectedOrgId}/roles`);
            return res.data.data.roles;
        },
        enabled: isOpen && !!selectedOrgId
    });

    const { data: membersData } = useQuery({
        queryKey: ['org-members', selectedOrgId],
        queryFn: async () => {
            if (!selectedOrgId) return [];
            const res = await api.get(`/organizations/${selectedOrgId}/members`);
            return res.data.data.members;
        },
        enabled: isOpen && !!selectedOrgId
    });

    const { data: templatesData } = useQuery({
        queryKey: ['approval-templates', selectedOrgId],
        queryFn: async () => {
            if (!selectedOrgId) return [];
            const res = await api.get(`/organizations/${selectedOrgId}/approval-templates`);
            return res.data.data.templates;
        },
        enabled: isOpen && !!selectedOrgId
    });

    const orgs = orgsData || [];
    const roles = rolesData || [];
    const members = membersData || [];
    const templates = templatesData || [];

    const handleLoadTemplate = (templateId) => {
        const tpl = templates.find(t => t.id === templateId);
        if (!tpl || !tpl.steps) return;
        setSteps(tpl.steps.map(s => ({
            role_name: s.role_name,
            approver_id: s.approver_id || ''
        })));
    };

    const submitMutation = useMutation({
        mutationFn: async (payload) => {
            const res = await api.post('/approvals', payload);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['approvals-submitted'] });
            alert('File approval request submitted successfully!');
            onClose();
        },
        onError: (err) => {
            setError(err.response?.data?.message || 'Failed to submit approval request');
        }
    });

    if (!isOpen || !item) return null;

    const handleAddStep = () => {
        setSteps([...steps, { role_name: 'Approver', approver_id: '' }]);
    };

    const handleRemoveStep = (idx) => {
        setSteps(steps.filter((_, i) => i !== idx));
    };

    const handleStepChange = (idx, field, value) => {
        const newSteps = [...steps];
        newSteps[idx][field] = value;
        setSteps(newSteps);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!selectedOrgId) {
            setError('Please select an Organization');
            return;
        }
        const reqTitle = title.trim() || `Approval for ${item.original_name || item.name}`;

        submitMutation.mutate({
            orgId: selectedOrgId,
            ...(isFile ? { fileId: item.id } : { folderId: item.id }),
            title: reqTitle,
            steps
        });
    };

    return (
        <Dialog open={isOpen} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ fontWeight: 'bold', pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <ApprovalIcon color="primary" />
                Submit "{item.original_name || item.name}" for Approval
            </DialogTitle>
            <DialogContent dividers>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <FormControl fullWidth size="small">
                        <InputLabel id="select-org-label">Select Organization</InputLabel>
                        <Select
                            labelId="select-org-label"
                            value={selectedOrgId}
                            label="Select Organization"
                            onChange={(e) => setSelectedOrgId(e.target.value)}
                            required
                        >
                            {orgs.map(o => <MenuItem key={o.id} value={o.id}>{o.name}</MenuItem>)}
                        </Select>
                    </FormControl>

                    <TextField 
                        fullWidth 
                        size="small" 
                        label="Approval Request Title" 
                        placeholder={`Approval for ${item.original_name || item.name}`} 
                        value={title} 
                        onChange={(e) => setTitle(e.target.value)} 
                    />

                    {templates.length > 0 && (
                        <FormControl fullWidth size="small">
                            <InputLabel>Load Template (Optional)</InputLabel>
                            <Select
                                value=""
                                label="Load Template (Optional)"
                                onChange={(e) => handleLoadTemplate(e.target.value)}
                            >
                                {templates.map(t => (
                                    <MenuItem key={t.id} value={t.id}>
                                        {t.name} ({t.steps?.length || 0} steps)
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    )}

                    <Typography variant="subtitle2" fontWeight="bold" sx={{ mt: 1 }}>
                        Configure Multi-Stage Approval Sequence
                    </Typography>

                    <Stack spacing={1.5}>
                        {steps.map((st, idx) => (
                            <Paper key={idx} variant="outlined" sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5, borderRadius: 2 }}>
                                <Chip label={`Step ${idx + 1}`} size="small" color="primary" />
                                <FormControl size="small" sx={{ width: 140 }}>
                                    <InputLabel>Role</InputLabel>
                                    <Select
                                        value={st.role_name}
                                        label="Role"
                                        onChange={(e) => handleStepChange(idx, 'role_name', e.target.value)}
                                    >
                                        {roles.length > 0 ? (
                                            roles.map(r => <MenuItem key={r.id} value={r.name}>{r.name}</MenuItem>)
                                        ) : (
                                            <MenuItem value="Approver">Approver</MenuItem>
                                        )}
                                    </Select>
                                </FormControl>

                                <FormControl size="small" sx={{ flexGrow: 1 }}>
                                    <InputLabel>Specific Approver (Optional)</InputLabel>
                                    <Select
                                        value={st.approver_id}
                                        label="Specific Approver (Optional)"
                                        onChange={(e) => handleStepChange(idx, 'approver_id', e.target.value)}
                                    >
                                        <MenuItem value="">Any member in role</MenuItem>
                                        {members.map(m => (
                                            <MenuItem key={m.id} value={m.user_id}>
                                                {m.full_name || m.email} ({m.role_name})
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>

                                {steps.length > 1 && (
                                    <Button color="error" size="small" onClick={() => handleRemoveStep(idx)}>
                                        <DeleteIcon fontSize="small" />
                                    </Button>
                                )}
                            </Paper>
                        ))}
                    </Stack>

                    <Button variant="outlined" startIcon={<AddIcon />} onClick={handleAddStep} sx={{ alignSelf: 'flex-start' }}>
                        Add Approval Step
                    </Button>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={submitMutation.isPending}>Cancel</Button>
                <Button 
                    variant="contained" 
                    onClick={handleSubmit} 
                    disabled={submitMutation.isPending || !selectedOrgId}
                    startIcon={submitMutation.isPending ? <CircularProgress size={16} color="inherit" /> : <ApprovalIcon />}
                >
                    {submitMutation.isPending ? 'Submitting...' : 'Submit Approval Request'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
