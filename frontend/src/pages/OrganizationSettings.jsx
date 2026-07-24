import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
    Box, Typography, Button, TextField, CircularProgress, Alert, Card, 
    CardContent, Stack, Avatar, Chip, Tabs, Tab, Table, TableBody, TableCell, 
    TableHead, TableRow, Dialog, DialogTitle, DialogContent, DialogActions, Select, MenuItem, FormControl, InputLabel
} from '@mui/material';
import { 
    Business as OrgIcon, 
    PersonAdd as PersonAddIcon, 
    AccountTree as TreeIcon,
    Add as AddIcon,
    Check as CheckIcon,
    Close as CloseIcon
} from '@mui/icons-material';
import api from '../services/api';
import RoleHierarchyCanvas from '../components/organization/RoleHierarchyCanvas';

export default function OrganizationSettings() {
    const [tab, setTab] = useState(0); // 0: Members & Invites, 1: Role Hierarchy Canvas
    const [selectedOrgId, setSelectedOrgId] = useState('');
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [newOrgName, setNewOrgName] = useState('');
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('Member');
    const [inviteSuccess, setInviteSuccess] = useState('');
    const [inviteError, setInviteError] = useState('');
    const queryClient = useQueryClient();

    // Query 1: Fetch user's organizations
    const { data: orgsData, isLoading: isOrgsLoading } = useQuery({
        queryKey: ['organizations'],
        queryFn: async () => {
            const res = await api.get('/organizations');
            const orgs = res.data.data.organizations;
            if (orgs.length > 0 && !selectedOrgId) {
                setSelectedOrgId(orgs[0].id);
            }
            return orgs;
        }
    });

    const userOrgs = orgsData || [];
    const activeOrg = userOrgs.find(o => o.id === selectedOrgId) || userOrgs[0];

    // Query 2: Fetch members for selected org
    const { data: membersData, isLoading: isMembersLoading } = useQuery({
        queryKey: ['org-members', selectedOrgId],
        queryFn: async () => {
            if (!selectedOrgId) return [];
            const res = await api.get(`/organizations/${selectedOrgId}/members`);
            return res.data.data.members;
        },
        enabled: !!selectedOrgId
    });

    // Query 3: Fetch roles for selected org
    const { data: rolesData } = useQuery({
        queryKey: ['org-roles', selectedOrgId],
        queryFn: async () => {
            if (!selectedOrgId) return [];
            const res = await api.get(`/organizations/${selectedOrgId}/roles`);
            return res.data.data.roles;
        },
        enabled: !!selectedOrgId
    });

    const orgMembers = membersData || [];
    const orgRoles = rolesData || [];

    // Mutation: Create Organization
    const createOrgMutation = useMutation({
        mutationFn: async (name) => {
            const res = await api.post('/organizations', { name });
            return res.data.data.organization;
        },
        onSuccess: (newOrg) => {
            queryClient.invalidateQueries({ queryKey: ['organizations'] });
            setSelectedOrgId(newOrg.id);
            setCreateModalOpen(false);
            setNewOrgName('');
        }
    });

    // Mutation: Invite Member
    const inviteMemberMutation = useMutation({
        mutationFn: async ({ email, roleName }) => {
            const res = await api.post(`/organizations/${selectedOrgId}/invite`, { email, roleName });
            return res.data.data.member;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['org-members', selectedOrgId] });
            setInviteSuccess(`Invitation sent to ${inviteEmail}! An inbox notification has been sent.`);
            setInviteEmail('');
            setTimeout(() => setInviteSuccess(''), 4000);
        },
        onError: (err) => {
            setInviteError(err.response?.data?.message || 'Failed to send invitation');
            setTimeout(() => setInviteError(''), 4000);
        }
    });

    // Mutation: Respond to invitation
    const respondInviteMutation = useMutation({
        mutationFn: async ({ orgId, accept }) => {
            const res = await api.post(`/organizations/${orgId}/respond`, { accept });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['organizations'] });
            queryClient.invalidateQueries({ queryKey: ['org-members'] });
        }
    });

    const handleInviteSubmit = (e) => {
        e.preventDefault();
        if (!inviteEmail.trim()) return;
        setInviteSuccess('');
        setInviteError('');
        inviteMemberMutation.mutate({ email: inviteEmail.trim(), roleName: inviteRole });
    };

    if (isOrgsLoading) return (
        <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress />
        </Box>
    );

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <OrgIcon color="primary" sx={{ fontSize: 32 }} />
                    <Typography color="text.primary" sx={{ fontSize: '1.25rem', fontWeight: 700 }}>
                        Organization & Role Settings
                    </Typography>
                </Box>

                <Button 
                    variant="contained" 
                    startIcon={<AddIcon />} 
                    onClick={() => setCreateModalOpen(true)}
                >
                    Create Organization
                </Button>
            </Box>

            {userOrgs.length > 0 && (
                <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                    <FormControl size="small" sx={{ minWidth: 250 }}>
                        <InputLabel id="select-org-label">Active Organization</InputLabel>
                        <Select
                            labelId="select-org-label"
                            value={selectedOrgId || (userOrgs[0] ? userOrgs[0].id : '')}
                            label="Active Organization"
                            onChange={(e) => setSelectedOrgId(e.target.value)}
                        >
                            {userOrgs.map(org => (
                                <MenuItem key={org.id} value={org.id}>
                                    {org.name} ({org.membership_status === 'accepted' ? org.role_name : 'Pending Invitation'})
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {activeOrg && activeOrg.membership_status === 'pending' && (
                        <Card variant="outlined" sx={{ bgcolor: 'warning.light', p: 1, px: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Typography variant="body2" fontWeight="bold">
                                You have a pending invitation to join "{activeOrg.name}" as {activeOrg.role_name}
                            </Typography>
                            <Button 
                                size="small" 
                                variant="contained" 
                                color="success" 
                                startIcon={<CheckIcon />}
                                onClick={() => respondInviteMutation.mutate({ orgId: activeOrg.id, accept: true })}
                            >
                                Accept
                            </Button>
                            <Button 
                                size="small" 
                                variant="outlined" 
                                color="error" 
                                startIcon={<CloseIcon />}
                                onClick={() => respondInviteMutation.mutate({ orgId: activeOrg.id, accept: false })}
                            >
                                Decline
                            </Button>
                        </Card>
                    )}
                </Box>
            )}

            {userOrgs.length === 0 ? (
                <Card variant="outlined" sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
                    <OrgIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                    <Typography variant="h6" fontWeight="bold" gutterBottom>
                        No Organizations Found
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        Create an organization to set up your team, design custom role hierarchies, and configure file approval workflows.
                    </Typography>
                    <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateModalOpen(true)}>
                        Create Your First Organization
                    </Button>
                </Card>
            ) : (
                <>
                    <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: '1px solid #EAEAEA' }}>
                        <Tab icon={<PersonAddIcon fontSize="small" />} iconPosition="start" label={`Members & Invites (${orgMembers.length})`} />
                        <Tab icon={<TreeIcon fontSize="small" />} iconPosition="start" label="No-Code Drag & Drop Role Hierarchy" />
                    </Tabs>

                    {/* TAB 0: MEMBERS & INVITES */}
                    {tab === 0 && (
                        <Box sx={{ flex: 1, overflowY: 'auto' }}>
                            <Card variant="outlined" sx={{ mb: 4, p: 3, borderRadius: 3 }}>
                                <Typography variant="h6" fontWeight="bold" gutterBottom>
                                    Invite Team Member
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    Send an invitation email and inbox notification to join <strong>{activeOrg?.name}</strong>.
                                </Typography>

                                {inviteSuccess && <Alert severity="success" sx={{ mb: 2 }}>{inviteSuccess}</Alert>}
                                {inviteError && <Alert severity="error" sx={{ mb: 2 }}>{inviteError}</Alert>}

                                <Box component="form" onSubmit={handleInviteSubmit} sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                                    <TextField 
                                        size="small" 
                                        type="email" 
                                        placeholder="user@example.com" 
                                        value={inviteEmail} 
                                        onChange={(e) => setInviteEmail(e.target.value)} 
                                        required 
                                        sx={{ flexGrow: 1, minWidth: 250 }}
                                    />
                                    <FormControl size="small" sx={{ width: 180 }}>
                                        <InputLabel id="invite-role-label">Org Role</InputLabel>
                                        <Select
                                            labelId="invite-role-label"
                                            value={inviteRole}
                                            label="Org Role"
                                            onChange={(e) => setInviteRole(e.target.value)}
                                        >
                                            {orgRoles.length > 0 ? (
                                                orgRoles.map(r => <MenuItem key={r.id} value={r.name}>{r.name}</MenuItem>)
                                            ) : (
                                                <MenuItem value="Member">Member</MenuItem>
                                            )}
                                        </Select>
                                    </FormControl>
                                    <Button 
                                        type="submit" 
                                        variant="contained" 
                                        startIcon={inviteMemberMutation.isPending ? <CircularProgress size={16} color="inherit" /> : <PersonAddIcon />}
                                        disabled={inviteMemberMutation.isPending || !inviteEmail.trim()}
                                    >
                                        Send Invitation
                                    </Button>
                                </Box>
                            </Card>

                            <Card variant="outlined" sx={{ borderRadius: 3 }}>
                                <CardContent>
                                    <Typography variant="h6" fontWeight="bold" gutterBottom>
                                        Organization Members
                                    </Typography>
                                    <Table>
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>User</TableCell>
                                                <TableCell>Email</TableCell>
                                                <TableCell>Role</TableCell>
                                                <TableCell>Status</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {orgMembers.map((m) => (
                                                <TableRow key={m.id}>
                                                    <TableCell>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                            <Avatar src={m.avatar_url}>{m.full_name?.charAt(0) || 'U'}</Avatar>
                                                            <Typography variant="body2" fontWeight="600">{m.full_name || 'Invited User'}</Typography>
                                                        </Box>
                                                    </TableCell>
                                                    <TableCell>{m.email}</TableCell>
                                                    <TableCell><Chip label={m.role_name} size="small" color="primary" variant="outlined" /></TableCell>
                                                    <TableCell>
                                                        <Chip 
                                                            label={m.status === 'accepted' ? 'Accepted' : 'Pending Invite'} 
                                                            size="small" 
                                                            color={m.status === 'accepted' ? 'success' : 'warning'} 
                                                        />
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        </Box>
                    )}

                    {/* TAB 1: NO-CODE ROLE HIERARCHY CANVAS */}
                    {tab === 1 && selectedOrgId && (
                        <RoleHierarchyCanvas orgId={selectedOrgId} />
                    )}
                </>
            )}

            {/* CREATE ORG MODAL */}
            <Dialog open={createModalOpen} onClose={() => setCreateModalOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ fontWeight: 'bold' }}>Create New Organization</DialogTitle>
                <DialogContent dividers>
                    <TextField 
                        fullWidth 
                        size="small" 
                        label="Organization Name" 
                        placeholder="e.g. Acme Corporation" 
                        value={newOrgName} 
                        onChange={(e) => setNewOrgName(e.target.value)} 
                        autoFocus 
                        sx={{ mt: 1 }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCreateModalOpen(false)}>Cancel</Button>
                    <Button 
                        variant="contained" 
                        onClick={() => createOrgMutation.mutate(newOrgName)} 
                        disabled={createOrgMutation.isPending || !newOrgName.trim()}
                    >
                        Create
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
