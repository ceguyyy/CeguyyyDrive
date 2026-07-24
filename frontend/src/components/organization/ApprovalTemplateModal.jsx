import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
    Box, Typography, Select, MenuItem, FormControl, InputLabel, IconButton,
    Paper, Stack, Alert
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, ArrowDownward as ArrowIcon } from '@mui/icons-material';
import api from '../../services/api';

export default function ApprovalTemplateModal({ isOpen, onClose, orgId, templateToEdit, roles = [], members = [] }) {
    const queryClient = useQueryClient();
    const [name, setName] = useState('');
    const [steps, setSteps] = useState([{ roleName: '', approverId: '' }]);
    const [error, setError] = useState('');

    const acceptedMembers = members.filter(m => m.status === 'accepted');

    useEffect(() => {
        if (templateToEdit) {
            setName(templateToEdit.name || '');
            setSteps(
                templateToEdit.steps?.length > 0
                    ? templateToEdit.steps.map(s => ({
                          roleName: s.role_name,
                          approverId: s.approver_id || ''
                      }))
                    : [{ roleName: '', approverId: '' }]
            );
        } else {
            setName('');
            setSteps([{ roleName: roles[0]?.name || '', approverId: '' }]);
        }
        setError('');
    }, [templateToEdit, isOpen, roles]);

    const handleAddStep = () => {
        setSteps(prev => [...prev, { roleName: roles[0]?.name || '', approverId: '' }]);
    };

    const handleRemoveStep = (index) => {
        if (steps.length <= 1) return;
        setSteps(prev => prev.filter((_, i) => i !== index));
    };

    const handleStepChange = (index, field, value) => {
        setSteps(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
    };

    const saveMutation = useMutation({
        mutationFn: async () => {
            if (!name.trim()) throw new Error('Template name is required');
            const validSteps = steps.filter(s => s.roleName);
            if (validSteps.length === 0) throw new Error('At least one step with a role is required');

            const payload = {
                name: name.trim(),
                steps: validSteps
            };

            if (templateToEdit) {
                return await api.put(`/organizations/${orgId}/approval-templates/${templateToEdit.id}`, payload);
            } else {
                return await api.post(`/organizations/${orgId}/approval-templates`, payload);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['approval-templates', orgId] });
            onClose();
        },
        onError: (err) => {
            setError(err?.response?.data?.message || err.message || 'Failed to save template');
        }
    });

    return (
        <Dialog open={isOpen} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle fontWeight="bold">
                {templateToEdit ? 'Edit Approval Template' : 'Create Approval Template'}
            </DialogTitle>
            <DialogContent dividers>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                <TextField
                    label="Template Name"
                    fullWidth
                    size="small"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Standard Purchase Approval"
                    sx={{ mb: 3 }}
                />

                <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1.5 }}>
                    Approval Steps (Executed in sequence)
                </Typography>

                <Stack spacing={2}>
                    {steps.map((step, index) => (
                        <React.Fragment key={index}>
                            <Paper variant="outlined" sx={{ p: 2, position: 'relative', bgcolor: '#FAFAFA' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                                    <Typography variant="body2" fontWeight="bold" color="primary">
                                        Step {index + 1}
                                    </Typography>
                                    {steps.length > 1 && (
                                        <IconButton size="small" color="error" onClick={() => handleRemoveStep(index)}>
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    )}
                                </Box>

                                <Stack spacing={2} direction={{ xs: 'column', sm: 'row' }}>
                                    <FormControl size="small" fullWidth required>
                                        <InputLabel>Required Role</InputLabel>
                                        <Select
                                            value={step.roleName}
                                            label="Required Role"
                                            onChange={(e) => handleStepChange(index, 'roleName', e.target.value)}
                                        >
                                            {roles.map(r => (
                                                <MenuItem key={r.id} value={r.name}>{r.name}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>

                                    <FormControl size="small" fullWidth>
                                        <InputLabel>Specific Approver (Optional)</InputLabel>
                                        <Select
                                            value={step.approverId}
                                            label="Specific Approver (Optional)"
                                            onChange={(e) => handleStepChange(index, 'approverId', e.target.value)}
                                        >
                                            <MenuItem value=""><em>Any member in role</em></MenuItem>
                                            {acceptedMembers.map(m => (
                                                <MenuItem key={m.user_id || m.email} value={m.user_id}>
                                                    {m.full_name || m.email} ({m.role_name})
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Stack>
                            </Paper>

                            {index < steps.length - 1 && (
                                <Box sx={{ display: 'flex', justifyContent: 'center', my: -0.5 }}>
                                    <ArrowIcon fontSize="small" color="action" />
                                </Box>
                            )}
                        </React.Fragment>
                    ))}
                </Stack>

                <Button
                    startIcon={<AddIcon />}
                    onClick={handleAddStep}
                    sx={{ mt: 2 }}
                    variant="outlined"
                    size="small"
                    fullWidth
                >
                    Add Approval Step
                </Button>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button
                    variant="contained"
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending || !name.trim()}
                >
                    {saveMutation.isPending ? 'Saving...' : 'Save Template'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
