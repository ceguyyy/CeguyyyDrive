import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Box, Typography, Button, TextField, CircularProgress, Alert, Card,
    CardContent, Stack, Avatar, Chip, Tabs, Tab, Table, TableBody, TableCell,
    TableHead, TableRow, Dialog, DialogTitle, DialogContent, DialogActions,
    Select, MenuItem, FormControl, InputLabel, IconButton, Divider, Tooltip, Paper, Grid
} from '@mui/material';
import {
    Business as OrgIcon,
    PersonAdd as PersonAddIcon,
    AccountTree as TreeIcon,
    Add as AddIcon,
    Check as CheckIcon,
    Close as CloseIcon,
    Delete as DeleteIcon,
    SwapHoriz as TransferIcon,
    Storage as StorageIcon,
    SwitchAccount as SwitchIcon,
    FactCheck as ApprovalIcon,
    Edit as EditIcon
} from '@mui/icons-material';
import api from '../services/api';
import RoleHierarchyCanvas from '../components/organization/RoleHierarchyCanvas';
import { useAuthStore } from '../store/authStore';
import ConfirmModal from '../components/modals/ConfirmModal';
import ApprovalTemplateModal from '../components/organization/ApprovalTemplateModal';

function MemberStorageLimitCell({ member, defaultLimitBytes, onSave, isOwnerRow = false }) {
    const initialVal = member.storage_limit ? (member.storage_limit / (1024 ** 3)).toFixed(1) : '';
    const [value, setValue] = useState(initialVal);
    const [isSaving, setIsSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const defaultGB = defaultLimitBytes ? Math.round(defaultLimitBytes / (1024 ** 3)) : 10;
    const placeholder = isOwnerRow ? `${defaultGB} GB (Org Max)` : `${defaultGB} GB (Default)`;

    useEffect(() => {
        setValue(member.storage_limit ? (member.storage_limit / (1024 ** 3)).toFixed(1) : '');
    }, [member.storage_limit]);

    const handleSave = async () => {
        setIsSaving(true);
        setSaved(false);
        try {
            const val = parseFloat(value);
            const bytes = isNaN(val) || val <= 0 ? null : val * (1024 ** 3);
            await onSave({ memberId: member.id, limitBytes: bytes });
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        } catch (err) {
            console.error('Failed to update storage limit', err);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <TextField
                size="small"
                type="number"
                placeholder={placeholder}
                value={value}
                onChange={(e) => {
                    setValue(e.target.value);
                    setSaved(false);
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSave();
                    }
                }}
                inputProps={{ min: 0, step: 0.5, style: { width: 65, fontSize: '0.8rem', padding: '4px 8px' } }}
                variant="outlined"
            />
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mr: 0.5 }}>GB</Typography>
            <Tooltip title="Save storage limit (Done)">
                <span>
                    <Button
                        size="small"
                        variant="contained"
                        color={saved ? "success" : "primary"}
                        onClick={handleSave}
                        disabled={isSaving}
                        sx={{
                            minWidth: 0,
                            px: 1.25,
                            py: 0.5,
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            textTransform: 'none',
                            borderRadius: 1.5,
                            boxShadow: 'none',
                            bgcolor: saved ? '#10B981' : '#1A1D20',
                            '&:hover': { bgcolor: saved ? '#059669' : '#2C3036', boxShadow: 'none' }
                        }}
                    >
                        {isSaving ? <CircularProgress size={12} color="inherit" /> : (saved ? "Done ✓" : "Done")}
                    </Button>
                </span>
            </Tooltip>
        </Box>
    );
}

export default function OrganizationSettings() {
    const user = useAuthStore(state => state.user);
    const activeOrgId = useAuthStore(state => state.activeOrgId);
    const setActiveOrgId = useAuthStore(state => state.setActiveOrgId);

    const [tab, setTab] = useState(0);
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [newOrgName, setNewOrgName] = useState('');
    const [createError, setCreateError] = useState('');
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('Member');
    const [inviteSuccess, setInviteSuccess] = useState('');
    const [inviteError, setInviteError] = useState('');
    const [memberActionError, setMemberActionError] = useState('');
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [transferModalOpen, setTransferModalOpen] = useState(false);
    const [transferTargetId, setTransferTargetId] = useState('');
    const [storageLimits, setStorageLimits] = useState({});

    // Approval Templates state
    const [templateModalOpen, setTemplateModalOpen] = useState(false);
    const [templateToEdit, setTemplateToEdit] = useState(null);

    const queryClient = useQueryClient();

    // ── Queries ────────────────────────────────────────────────────────────────
    const { data: orgsData, isLoading: isOrgsLoading } = useQuery({
        queryKey: ['organizations'],
        queryFn: async () => {
            const res = await api.get('/organizations');
            const payload = res.data.data;
            if (payload.organizations.length > 0 && !activeOrgId) setActiveOrgId(payload.organizations[0].id);
            return payload;
        }
    });

    const { data: membersData, isLoading: isMembersLoading } = useQuery({
        queryKey: ['org-members', activeOrgId],
        queryFn: async () => {
            if (!activeOrgId) return [];
            const res = await api.get(`/organizations/${activeOrgId}/members`);
            return res.data.data.members;
        },
        enabled: !!activeOrgId
    });

    const { data: rolesData } = useQuery({
        queryKey: ['org-roles', activeOrgId],
        queryFn: async () => {
            if (!activeOrgId) return [];
            const res = await api.get(`/organizations/${activeOrgId}/roles`);
            return res.data.data.roles;
        },
        enabled: !!activeOrgId
    });

    // What this user may do with members, derived server-side from the role
    // tree. Kept on the server so the UI and the enforcement cannot drift.
    const { data: permissionsData } = useQuery({
        queryKey: ['org-permissions', activeOrgId],
        queryFn: async () => {
            if (!activeOrgId) return null;
            const res = await api.get(`/organizations/${activeOrgId}/my-permissions`);
            return res.data.data.permissions;
        },
        enabled: !!activeOrgId
    });

    const { data: templatesData } = useQuery({
        queryKey: ['approval-templates', activeOrgId],
        queryFn: async () => {
            if (!activeOrgId) return [];
            const res = await api.get(`/organizations/${activeOrgId}/approval-templates`);
            return res.data.data.templates;
        },
        enabled: !!activeOrgId
    });

    const userOrgs = orgsData?.organizations ?? [];
    const ownedOrgCount = orgsData?.ownedCount ?? 0;
    const maxOwnedOrgs = orgsData?.maxOwnedOrganizations ?? null;
    // Super Admins have no cap. The server sends a sentinel that fits the INT
    // column, so the flag — not the number — decides what to render.
    const hasUnlimitedOrgs = orgsData?.unlimitedOrganizations === true;
    const isAtOrgLimit = !hasUnlimitedOrgs && maxOwnedOrgs !== null && ownedOrgCount >= maxOwnedOrgs;
    const orgMembers = membersData || [];
    const orgRoles = rolesData || [];

    const activeOrg = userOrgs.find(o => o.id === activeOrgId) || userOrgs[0];
    const isOwner = activeOrg?.owner_id === user?.id;

    // Determine the current user's role in this org (from members list)
    const currentUserMember = orgMembers.find(m => m.user_id === user?.id || m.email === user?.email);
    const currentUserRoleName = currentUserMember?.role_name || activeOrg?.role_name;

    // Roles this user may hand out, and members they may act on. Both come from
    // the server's reading of the role tree: strictly below your own role, with
    // the Owner role never assignable (it moves via Transfer Owner only).
    const permissions = permissionsData ?? {
        assignableRoles: [],
        manageableRoleNames: [],
        canManageAnyRole: false
    };
    const invitableRoles = permissions.assignableRoles;
    const canInvite = invitableRoles.length > 0;
    const effectiveInviteRole = invitableRoles.includes(inviteRole)
        ? inviteRole
        : (invitableRoles[0] || '');

    // The owner's row is untouchable and nobody edits their own role, so those
    // two cases are excluded before consulting the hierarchy.
    const canManageMemberRole = (member) => {
        if (member.user_id && member.user_id === activeOrg?.owner_id) return false;
        if (currentUserMember && member.id === currentUserMember.id) return false;
        if (permissions.canManageAnyRole) return true;
        return permissions.manageableRoleNames.includes(member.role_name);
    };
    const orgTemplates = templatesData || [];


    // ── Mutations ──────────────────────────────────────────────────────────────
    const deleteTemplateMutation = useMutation({
        mutationFn: async (templateId) => {
            await api.delete(`/organizations/${activeOrgId}/approval-templates/${templateId}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['approval-templates', activeOrgId] });
        }
    });

    // ── Mutations ──────────────────────────────────────────────────────────────
    const createOrgMutation = useMutation({
        mutationFn: async (name) => {
            const res = await api.post('/organizations', { name });
            return res.data.data.organization;
        },
        onSuccess: (newOrg) => {
            queryClient.invalidateQueries({ queryKey: ['organizations'] });
            setActiveOrgId(newOrg.id);
            setCreateModalOpen(false);
            setNewOrgName('');
            setCreateError('');
        },
        onError: (err) => {
            setCreateError(err.response?.data?.message || 'Failed to create organization');
        }
    });

    const inviteMemberMutation = useMutation({
        mutationFn: async ({ email, roleName }) => {
            const res = await api.post(`/organizations/${activeOrgId}/invite`, { email, roleName });
            return res.data.data.member;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['org-members', activeOrgId] });
            setInviteSuccess(`Invitation sent to ${inviteEmail}!`);
            setInviteEmail('');
            setTimeout(() => setInviteSuccess(''), 4000);
        },
        onError: (err) => {
            setInviteError(err.response?.data?.message || 'Failed to send invitation');
            setTimeout(() => setInviteError(''), 4000);
        }
    });

    const changeMemberRoleMutation = useMutation({
        mutationFn: async ({ memberId, roleName }) => {
            await api.patch(`/organizations/${activeOrgId}/members/${memberId}/role`, { roleName });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['org-members', activeOrgId] });
            setMemberActionError('');
        },
        onError: (err) => {
            setMemberActionError(err.response?.data?.message || 'Failed to change role');
            setTimeout(() => setMemberActionError(''), 5000);
        }
    });

    const removeMemberMutation = useMutation({
        mutationFn: async (memberId) => {
            await api.delete(`/organizations/${activeOrgId}/members/${memberId}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['org-members', activeOrgId] });
        }
    });

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

    const deleteOrgMutation = useMutation({
        mutationFn: async (orgId) => {
            await api.delete(`/organizations/${orgId}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['organizations'] });
            setActiveOrgId(null);
            setDeleteModalOpen(false);
        }
    });

    const transferOwnerMutation = useMutation({
        mutationFn: async ({ orgId, newOwnerId }) => {
            await api.post(`/organizations/${orgId}/transfer-owner`, { newOwnerId });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['organizations'] });
            queryClient.invalidateQueries({ queryKey: ['org-members', activeOrgId] });
            queryClient.invalidateQueries({ queryKey: ['org-permissions', activeOrgId] });
            setTransferModalOpen(false);
            setTransferTargetId('');
        }
    });

    // Storage limit per member (owner can set)
    const updateStorageLimitMutation = useMutation({
        mutationFn: async ({ memberId, limitBytes }) => {
            await api.patch(`/organizations/${activeOrgId}/members/${memberId}/storage`, { storage_limit: limitBytes });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['org-members', activeOrgId] });
        }
    });

    const handleInviteSubmit = (e) => {
        e.preventDefault();
        if (!inviteEmail.trim()) return;
        setInviteSuccess('');
        setInviteError('');
        inviteMemberMutation.mutate({ email: inviteEmail.trim(), roleName: effectiveInviteRole });
    };

    if (isOrgsLoading) return (
        <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress />
        </Box>
    );

    const acceptedMembers = orgMembers.filter(m => m.status === 'accepted' && m.user_id !== user?.id);

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* ── Page Header ──────────────────────────────────────────────── */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <OrgIcon color="primary" sx={{ fontSize: 32 }} />
                    <Typography color="text.primary" sx={{ fontSize: '1.25rem', fontWeight: 700 }}>
                        Organization Settings
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    {maxOwnedOrgs !== null && (
                        <Typography variant="caption" sx={{ fontWeight: 600 }} color={isAtOrgLimit ? 'error.main' : 'text.secondary'}>
                            {hasUnlimitedOrgs
                                ? `${ownedOrgCount} organization${ownedOrgCount === 1 ? '' : 's'} · Unlimited`
                                : `${ownedOrgCount} of ${maxOwnedOrgs} organizations used`}
                        </Typography>
                    )}
                    <Tooltip title={!isAtOrgLimit ? '' : maxOwnedOrgs === 0
                        ? 'Creating an organization requires a license key. Redeem one to get started.'
                        : `Your plan allows ${maxOwnedOrgs} organization${maxOwnedOrgs === 1 ? '' : 's'}. Delete one to create another.`}>
                        <span>
                            <Button
                                variant="contained" startIcon={<AddIcon />}
                                disabled={isAtOrgLimit}
                                onClick={() => setCreateModalOpen(true)}
                            >
                                Create Organization
                            </Button>
                        </span>
                    </Tooltip>
                </Box>
            </Box>

            {/* ── Org Selector + Actions ─────────────────────────────────── */}
            {userOrgs.length > 0 && (
                <Card variant="outlined" sx={{ mb: 3, p: 2, borderRadius: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <SwitchIcon color="primary" fontSize="small" />
                            <Typography variant="body2" fontWeight={700} color="text.secondary">
                                SWITCH ORGANIZATION
                            </Typography>
                        </Box>
                        <FormControl size="small" sx={{ minWidth: 220 }}>
                            <Select
                                value={activeOrgId || (userOrgs[0]?.id ?? '')}
                                onChange={(e) => setActiveOrgId(e.target.value)}
                            >
                                {userOrgs.map(org => (
                                    <MenuItem key={org.id} value={org.id}>
                                        {org.name}
                                        <Chip
                                            label={org.membership_status === 'accepted' ? org.role_name : 'Pending'}
                                            size="small"
                                            color={org.membership_status === 'accepted' ? 'primary' : 'warning'}
                                            variant="outlined"
                                            sx={{ ml: 1, height: 18, fontSize: '0.65rem' }}
                                        />
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <Box sx={{ flexGrow: 1 }} />

                        {/* Transfer Owner */}
                        {isOwner && (
                            <Button
                                variant="outlined"
                                color="warning"
                                size="small"
                                startIcon={<TransferIcon />}
                                onClick={() => setTransferModalOpen(true)}
                            >
                                Transfer Owner
                            </Button>
                        )}

                        {/* Delete Org */}
                        {isOwner && (
                            <Button
                                variant="outlined"
                                color="error"
                                size="small"
                                startIcon={<DeleteIcon />}
                                onClick={() => setDeleteModalOpen(true)}
                            >
                                Delete Org
                            </Button>
                        )}
                    </Box>

                    {/* Pending Invite Banner */}
                    {activeOrg?.membership_status === 'pending' && (
                        <Box sx={{ mt: 2, p: 1.5, bgcolor: 'warning.50', borderRadius: 2, border: '1px solid', borderColor: 'warning.200', display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Typography variant="body2" fontWeight="bold" sx={{ flexGrow: 1 }}>
                                ⚠️ You have a pending invitation to join "{activeOrg.name}" as {activeOrg.role_name}
                            </Typography>
                            <Button
                                size="small" variant="contained" color="success"
                                startIcon={<CheckIcon />}
                                onClick={() => respondInviteMutation.mutate({ orgId: activeOrg.id, accept: true })}
                            >
                                Accept
                            </Button>
                            <Button
                                size="small" variant="outlined" color="error"
                                startIcon={<CloseIcon />}
                                onClick={() => respondInviteMutation.mutate({ orgId: activeOrg.id, accept: false })}
                            >
                                Decline
                            </Button>
                        </Box>
                    )}
                </Card>
            )}

            {/* ── Main Content ──────────────────────────────────────────────── */}
            {userOrgs.length === 0 ? (
                <Card variant="outlined" sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
                    <OrgIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                    <Typography variant="h6" fontWeight="bold" gutterBottom>No Organizations Found</Typography>
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
                        <Tab icon={<TreeIcon fontSize="small" />} iconPosition="start" label="Hierarchy" />
                        <Tab icon={<ApprovalIcon fontSize="small" />} iconPosition="start" label={`Approval Templates (${orgTemplates.length})`} />
                    </Tabs>

                    {/* ── TAB 0: Members & Invites ───────────────────────────── */}
                    {tab === 0 && (
                        <Box sx={{ flex: 1, overflowY: 'auto' }}>
                            {/* Invite Card — hidden entirely when the hierarchy
                                leaves this user no role to hand out. */}
                            {canInvite && (
                            <Card variant="outlined" sx={{ mb: 3, p: 3, borderRadius: 3 }}>
                                <Typography variant="h6" fontWeight="bold" gutterBottom>Invite Team Member</Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    Send an invitation to join <strong>{activeOrg?.name}</strong>.
                                    {currentUserRoleName && (
                                        <> You are <Chip label={currentUserRoleName} size="small" variant="outlined" color="primary" sx={{ mx: 0.5, height: 18, fontSize: '0.65rem', verticalAlign: 'middle' }} /> — you can only invite members to roles below your own.</>
                                    )}
                                </Typography>
                                {inviteSuccess && <Alert severity="success" sx={{ mb: 2 }}>{inviteSuccess}</Alert>}
                                {inviteError && <Alert severity="error" sx={{ mb: 2 }}>{inviteError}</Alert>}
                                <Box component="form" onSubmit={handleInviteSubmit} sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                                    <TextField
                                        size="small" type="email" placeholder="user@example.com"
                                        value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
                                        required sx={{ flexGrow: 1, minWidth: 220 }}
                                    />
                                    <FormControl size="small" sx={{ width: 180 }}>
                                        <InputLabel id="invite-role-label">Role</InputLabel>
                                        <Select labelId="invite-role-label" value={effectiveInviteRole} label="Role" onChange={(e) => setInviteRole(e.target.value)}>
                                            {invitableRoles.map(name => <MenuItem key={name} value={name}>{name}</MenuItem>)}
                                        </Select>
                                    </FormControl>
                                    <Button type="submit" variant="contained"
                                        startIcon={inviteMemberMutation.isPending ? <CircularProgress size={16} color="inherit" /> : <PersonAddIcon />}
                                        disabled={inviteMemberMutation.isPending || !inviteEmail.trim()}
                                    >
                                        Send Invitation
                                    </Button>
                                </Box>
                            </Card>
                            )}

                            {/* Members Table */}
                            <Card variant="outlined" sx={{ borderRadius: 3 }}>
                                <CardContent>
                                    <Typography variant="h6" fontWeight="bold" gutterBottom>Organization Members</Typography>
                                    {memberActionError && <Alert severity="error" sx={{ mb: 2 }}>{memberActionError}</Alert>}
                                    {isMembersLoading ? (
                                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
                                    ) : (
                                        <Table>
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell>User</TableCell>
                                                    <TableCell>Email</TableCell>
                                                    <TableCell>Role</TableCell>
                                                    <TableCell>Status</TableCell>
                                                    {isOwner && <TableCell>Storage Limit</TableCell>}
                                                    {isOwner && <TableCell>Actions</TableCell>}
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {orgMembers.map((m) => (
                                                    <TableRow key={m.id}>
                                                        <TableCell>
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                                <Avatar src={m.avatar_url} sx={{ width: 32, height: 32 }}>
                                                                    {(m.full_name || m.email || 'U').charAt(0).toUpperCase()}
                                                                </Avatar>
                                                                <Typography variant="body2" fontWeight={600}>
                                                                    {m.full_name || 'Invited User'}
                                                                </Typography>
                                                            </Box>
                                                        </TableCell>
                                                        <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{m.email}</TableCell>
                                                        <TableCell>
                                                            {canManageMemberRole(m) ? (
                                                                <FormControl size="small" sx={{ minWidth: 130 }}>
                                                                    <Select
                                                                        value={m.role_name}
                                                                        disabled={changeMemberRoleMutation.isPending}
                                                                        onChange={(e) => changeMemberRoleMutation.mutate({ memberId: m.id, roleName: e.target.value })}
                                                                        sx={{ fontSize: '0.8rem' }}
                                                                    >
                                                                        {/* The current role can sit outside assignableRoles — an
                                                                            orphan role seen by the owner — and MUI would render a
                                                                            blank value without this option. */}
                                                                        {!permissions.assignableRoles.includes(m.role_name) && (
                                                                            <MenuItem value={m.role_name} disabled>{m.role_name}</MenuItem>
                                                                        )}
                                                                        {permissions.assignableRoles.map(name => (
                                                                            <MenuItem key={name} value={name}>{name}</MenuItem>
                                                                        ))}
                                                                    </Select>
                                                                </FormControl>
                                                            ) : (
                                                                <Chip label={m.role_name} size="small" color={m.role_name === 'Owner' ? 'error' : 'primary'} variant="outlined" />
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Chip
                                                                label={m.status === 'accepted' ? 'Active' : 'Pending'}
                                                                size="small"
                                                                color={m.status === 'accepted' ? 'success' : 'warning'}
                                                            />
                                                        </TableCell>

                                                        {/* Storage Limit (owner only) */}
                                                        {isOwner && (
                                                            <TableCell>
                                                                <MemberStorageLimitCell
                                                                    member={m}
                                                                    isOwnerRow={m.role_name === 'Owner'}
                                                                    defaultLimitBytes={
                                                                        m.role_name === 'Owner'
                                                                            ? (userOrgs.find(o => o.id === activeOrgId)?.storage_limit_bytes || 53687091200)
                                                                            : (userOrgs.find(o => o.id === activeOrgId)?.member_storage_limit_bytes || 10737418240)
                                                                    }
                                                                    onSave={(args) => updateStorageLimitMutation.mutateAsync(args)}
                                                                />
                                                            </TableCell>
                                                        )}

                                                        {/* Remove Member */}
                                                        {isOwner && (
                                                            <TableCell>
                                                                {m.role_name !== 'Owner' && (
                                                                    <Tooltip title="Remove from org">
                                                                        <IconButton
                                                                            size="small"
                                                                            color="error"
                                                                            onClick={() => removeMemberMutation.mutate(m.id)}
                                                                        >
                                                                            <DeleteIcon fontSize="small" />
                                                                        </IconButton>
                                                                    </Tooltip>
                                                                )}
                                                            </TableCell>
                                                        )}
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    )}
                                </CardContent>
                            </Card>
                        </Box>
                    )}

                    {/* ── TAB 1: Hierarchy Canvas ──────────────────────────── */}
                    {tab === 1 && activeOrgId && (
                        <RoleHierarchyCanvas
                            orgId={activeOrgId}
                            orgOwnerId={activeOrg?.owner_id}
                            members={orgMembers}
                            currentUserMembership={orgMembers.find(m => m.user_id === user?.id)}
                            storageLimitBytes={activeOrg?.storage_limit_bytes ? parseInt(activeOrg.storage_limit_bytes, 10) : null}
                            onSaved={() => {
                                queryClient.invalidateQueries({ queryKey: ['org-roles', activeOrgId] });
                                queryClient.invalidateQueries({ queryKey: ['org-permissions', activeOrgId] });
                            }}
                        />
                    )}

                    {/* ── TAB 2: Approval Templates ────────────────────────── */}
                    {tab === 2 && activeOrgId && (
                        <Box sx={{ flex: 1, overflowY: 'auto' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                                <Box>
                                    <Typography variant="h6" fontWeight="bold">Approval Workflow Templates</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Create reusable multi-step approval sequences for files in <strong>{activeOrg?.name}</strong>.
                                    </Typography>
                                </Box>
                                <Button
                                    variant="contained"
                                    startIcon={<AddIcon />}
                                    onClick={() => {
                                        setTemplateToEdit(null);
                                        setTemplateModalOpen(true);
                                    }}
                                >
                                    New Template
                                </Button>
                            </Box>

                            {orgTemplates.length === 0 ? (
                                <Card variant="outlined" sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
                                    <ApprovalIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>No Approval Templates Yet</Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                        Create templates to quickly load preset multi-step approval chains when submitting files.
                                    </Typography>
                                    <Button
                                        variant="outlined"
                                        startIcon={<AddIcon />}
                                        onClick={() => {
                                            setTemplateToEdit(null);
                                            setTemplateModalOpen(true);
                                        }}
                                    >
                                        Create First Template
                                    </Button>
                                </Card>
                            ) : (
                                <Grid container spacing={2}>
                                    {orgTemplates.map(tpl => (
                                        <Grid item xs={12} sm={6} md={4} key={tpl.id}>
                                            <Card variant="outlined" sx={{ borderRadius: 3, p: 2.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
                                                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
                                                    <Box>
                                                        <Typography variant="subtitle1" fontWeight="bold" noWrap>{tpl.name}</Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            By {tpl.creator_name || 'Member'} • {tpl.steps?.length || 0} step(s)
                                                        </Typography>
                                                    </Box>
                                                    <Stack direction="row" spacing={0.5}>
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => {
                                                                setTemplateToEdit(tpl);
                                                                setTemplateModalOpen(true);
                                                            }}
                                                        >
                                                            <EditIcon fontSize="small" />
                                                        </IconButton>
                                                        <IconButton
                                                            size="small"
                                                            color="error"
                                                            onClick={() => deleteTemplateMutation.mutate(tpl.id)}
                                                        >
                                                            <DeleteIcon fontSize="small" />
                                                        </IconButton>
                                                    </Stack>
                                                </Box>

                                                <Divider sx={{ my: 1 }} />

                                                <Stack spacing={1} sx={{ mt: 1, flex: 1 }}>
                                                    {tpl.steps?.map((step, idx) => (
                                                        <Paper key={step.id || idx} variant="outlined" sx={{ p: 1, px: 1.5, bgcolor: '#FAFAFA', borderRadius: 1.5 }}>
                                                            <Typography variant="caption" fontWeight="bold" color="primary" display="block">
                                                                Step {step.step_number}: {step.role_name}
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary">
                                                                {step.approver_name ? `Approver: ${step.approver_name}` : 'Any member in role'}
                                                            </Typography>
                                                        </Paper>
                                                    ))}
                                                </Stack>
                                            </Card>
                                        </Grid>
                                    ))}
                                </Grid>
                            )}

                            <ApprovalTemplateModal
                                isOpen={templateModalOpen}
                                onClose={() => setTemplateModalOpen(false)}
                                orgId={activeOrgId}
                                templateToEdit={templateToEdit}
                                roles={orgRoles}
                                members={orgMembers}
                            />
                        </Box>
                    )}
                </>
            )}

            {/* ── Create Org Modal ──────────────────────────────────────────── */}
            <Dialog open={createModalOpen} onClose={() => { setCreateModalOpen(false); setCreateError(''); }} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ fontWeight: 'bold' }}>Create New Organization</DialogTitle>
                <DialogContent dividers>
                    {createError && (
                        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setCreateError('')}>
                            {createError}
                        </Alert>
                    )}
                    <TextField
                        fullWidth size="small" label="Organization Name"
                        placeholder="e.g. Acme Corporation" value={newOrgName}
                        onChange={(e) => setNewOrgName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && newOrgName.trim() && createOrgMutation.mutate(newOrgName)}
                        autoFocus sx={{ mt: 1 }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCreateModalOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={() => createOrgMutation.mutate(newOrgName)}
                        disabled={createOrgMutation.isPending || !newOrgName.trim()}>
                        Create
                    </Button>
                </DialogActions>
            </Dialog>

            {/* ── Transfer Owner Modal ──────────────────────────────────────── */}
            <Dialog open={transferModalOpen} onClose={() => setTransferModalOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ fontWeight: 'bold' }}>Transfer Ownership</DialogTitle>
                <DialogContent dividers>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Select a member to become the new Owner of <strong>{activeOrg?.name}</strong>. Your role will change to Manager.
                    </Typography>
                    <FormControl fullWidth size="small">
                        <InputLabel>Select New Owner</InputLabel>
                        <Select value={transferTargetId} label="Select New Owner" onChange={(e) => setTransferTargetId(e.target.value)}>
                            {acceptedMembers.map(m => (
                                <MenuItem key={m.user_id || m.email} value={m.user_id}>
                                    {m.full_name || m.email} — {m.role_name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setTransferModalOpen(false)}>Cancel</Button>
                    <Button
                        variant="contained" color="warning"
                        disabled={!transferTargetId || transferOwnerMutation.isPending}
                        onClick={() => transferOwnerMutation.mutate({ orgId: activeOrg.id, newOwnerId: transferTargetId })}
                    >
                        {transferOwnerMutation.isPending ? 'Transferring…' : 'Confirm Transfer'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* ── Delete Org Confirm ────────────────────────────────────────── */}
            <ConfirmModal
                isOpen={deleteModalOpen}
                title="Delete Organization"
                message={`Are you sure you want to permanently delete "${activeOrg?.name}"? All roles, members, and approval workflows will be permanently deleted.`}
                confirmText="Delete Permanently"
                isDestructive={true}
                isPending={deleteOrgMutation.isPending}
                onConfirm={() => deleteOrgMutation.mutate(activeOrg.id)}
                onClose={() => setDeleteModalOpen(false)}
            />
        </Box>
    );
}
