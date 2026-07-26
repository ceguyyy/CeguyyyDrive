import React, { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { 
    Dialog, DialogTitle, DialogContent, DialogActions, 
    Button, Typography, Box, TextField, Select, MenuItem, 
    FormControl, InputLabel, CircularProgress, Alert, Stack, Chip, Paper,
    Tooltip, IconButton, Divider
} from '@mui/material';
import { 
    FactCheck as ApprovalIcon, 
    Add as AddIcon,
    Delete as DeleteIcon,
    UploadFile as UploadFileIcon,
    CloudUpload as CloudUploadIcon,
    Close as CloseIcon
} from '@mui/icons-material';
import api from '../../services/api';

export default function RequestApprovalUploadModal({ isOpen, onClose, folderId = 'root' }) {
    const [selectedFile, setSelectedFile] = useState(null);
    const [selectedOrgId, setSelectedOrgId] = useState('');
    const [title, setTitle] = useState('');
    const [steps, setSteps] = useState([{ role_name: 'Manager', approver_id: '' }]);
    const [revisionPolicy, setRevisionPolicy] = useState('restart');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    
    const fileInputRef = useRef(null);
    const queryClient = useQueryClient();

    const { data: orgsData } = useQuery({
        queryKey: ['organizations'],
        queryFn: async () => {
            const res = await api.get('/organizations');
            const payload = res.data.data;
            if (payload.organizations?.length > 0 && !selectedOrgId) {
                setSelectedOrgId(payload.organizations[0].id);
            }
            return payload;
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

    const orgs = orgsData?.organizations ?? [];
    const roles = rolesData || [];
    const members = membersData || [];
    const templates = templatesData || [];

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            if (!title || title.startsWith('Approval for ')) {
                setTitle(`Approval for ${file.name}`);
            }
        }
    };

    const handleLoadTemplate = (templateId) => {
        const tpl = templates.find(t => t.id === templateId);
        if (!tpl || !tpl.steps) return;
        setSteps(tpl.steps.map(s => ({
            role_name: s.role_name,
            approver_id: s.approver_id || ''
        })));
        if (tpl.revision_policy) {
            setRevisionPolicy(tpl.revision_policy);
        }
    };

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

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedFile) {
            setError('Please select or drop a file to upload for approval.');
            return;
        }
        if (!selectedOrgId) {
            setError('Please select an Organization.');
            return;
        }
        setSubmitting(true);
        setError('');
        try {
            // Step 1: Request pre-signed upload URL for this file in current folder (or root)
            const { data: { data: uploadData } } = await api.post('/storage/upload-url', {
                fileName: selectedFile.name,
                size: selectedFile.size,
                mimeType: selectedFile.type || 'application/octet-stream',
                folderId: folderId && folderId !== 'root' ? folderId : null
            });

            const { uploadUrl, fileId } = uploadData;

            // Step 2: Upload directly to object storage
            await axios.put(uploadUrl, selectedFile, {
                headers: {
                    'Content-Type': selectedFile.type || 'application/octet-stream'
                }
            });

            // Step 3: Submit the approval workflow request
            const reqTitle = title.trim() || `Approval for ${selectedFile.name}`;
            await api.post('/approvals', {
                orgId: selectedOrgId,
                fileId: fileId,
                title: reqTitle,
                steps,
                revisionPolicy
            });

            queryClient.invalidateQueries({ queryKey: ['folders'] });
            queryClient.invalidateQueries({ queryKey: ['approvals-submitted'] });
            queryClient.invalidateQueries({ queryKey: ['approvals-pending'] });

            alert('File uploaded and submitted for approval successfully!');
            setSelectedFile(null);
            setTitle('');
            setSteps([{ role_name: 'Manager', approver_id: '' }]);
            onClose();
        } catch (err) {
            console.error("Request approval upload failed:", err);
            setError(err.response?.data?.message || 'Failed to upload file and submit approval request.');
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onClose={() => !submitting && onClose()} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ fontWeight: 'bold', pb: 1, display: 'flex', alignItems: 'center', gap: 1, color: '#37352F' }}>
                <ApprovalIcon color="primary" />
                Request Approval & Upload File
            </DialogTitle>
            <DialogContent dividers>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                    {/* File Upload Area */}
                    <Box>
                        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 0.5, textTransform: 'uppercase' }}>
                            1. Select Document for Review
                        </Typography>
                        {!selectedFile ? (
                            <Paper 
                                variant="outlined" 
                                onClick={() => fileInputRef.current?.click()}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    const file = e.dataTransfer.files?.[0];
                                    if (file) {
                                        setSelectedFile(file);
                                        if (!title || title.startsWith('Approval for ')) {
                                            setTitle(`Approval for ${file.name}`);
                                        }
                                    }
                                }}
                                sx={{ 
                                    p: 3, 
                                    border: '2px dashed #D3D1CB', 
                                    borderRadius: 2, 
                                    bgcolor: '#F7F7F5', 
                                    textAlign: 'center', 
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    '&:hover': { bgcolor: '#EFEFED', borderColor: '#73726E' } 
                                }}
                            >
                                <CloudUploadIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                                <Typography variant="subtitle2" fontWeight="bold" sx={{ color: '#37352F' }}>
                                    Click to select or drag and drop a file here
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#73726E' }}>
                                    Upload any document, PDF, spreadsheet, or image to submit for approval review
                                </Typography>
                            </Paper>
                        ) : (
                            <Paper variant="outlined" sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: '#E7F3F8', borderColor: '#1879B5', borderRadius: 2 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, overflow: 'hidden' }}>
                                    <UploadFileIcon sx={{ color: '#1879B5', fontSize: 32, flexShrink: 0 }} />
                                    <Box sx={{ minWidth: 0 }}>
                                        <Typography variant="body2" fontWeight={700} sx={{ color: '#1879B5', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {selectedFile.name}
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: '#73726E' }}>
                                            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB · Ready for submission
                                        </Typography>
                                    </Box>
                                </Box>
                                <Tooltip title="Remove file">
                                    <IconButton size="small" color="error" onClick={() => setSelectedFile(null)}>
                                        <CloseIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            </Paper>
                        )}
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleFileChange} 
                            style={{ display: 'none' }} 
                        />
                    </Box>

                    <Divider />

                    {/* Workflow Configuration */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', textTransform: 'uppercase' }}>
                            2. Approval Workflow Settings
                        </Typography>

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
                            placeholder={selectedFile ? `Approval for ${selectedFile.name}` : "Enter request title..."} 
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

                        <FormControl fullWidth size="small">
                            <InputLabel>When an approver requests a revision</InputLabel>
                            <Select
                                value={revisionPolicy}
                                label="When an approver requests a revision"
                                onChange={(e) => setRevisionPolicy(e.target.value)}
                            >
                                <MenuItem value="restart">
                                    Restart from step 1 (Every approver reviews the revised file again from step 1)
                                </MenuItem>
                                <MenuItem value="resume">
                                    Resume at the step that requested changes (Review resumes from the step that requested changes)
                                </MenuItem>
                            </Select>
                        </FormControl>

                        <Typography variant="subtitle2" fontWeight="bold" sx={{ mt: 1, color: '#37352F' }}>
                            Configure Multi-Stage Approval Sequence
                        </Typography>

                        <Stack spacing={1.5}>
                            {steps.map((st, idx) => (
                                <Paper key={idx} variant="outlined" sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5, borderRadius: 2, bgcolor: '#FDFDFC' }}>
                                    <Chip label={`Step ${idx + 1}`} size="small" color="primary" sx={{ fontWeight: 600 }} />
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
                                        <Button color="error" size="small" onClick={() => handleRemoveStep(idx)} sx={{ minWidth: 'auto', p: 1 }}>
                                            <DeleteIcon fontSize="small" />
                                        </Button>
                                    )}
                                </Paper>
                            ))}
                        </Stack>

                        <Button variant="outlined" startIcon={<AddIcon />} onClick={handleAddStep} sx={{ alignSelf: 'flex-start', borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>
                            Add Approval Step
                        </Button>
                    </Box>
                </Box>
            </DialogContent>
            <DialogActions sx={{ p: 2, bgcolor: '#F7F7F5' }}>
                <Button onClick={onClose} disabled={submitting} sx={{ color: '#73726E' }}>Cancel</Button>
                <Button 
                    variant="contained" 
                    onClick={handleSubmit} 
                    disabled={submitting || !selectedFile || !selectedOrgId}
                    startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <ApprovalIcon />}
                    sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, px: 3 }}
                >
                    {submitting ? 'Uploading & Submitting...' : 'Upload & Submit Request'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
