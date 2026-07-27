import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
    Box, Typography, Grid, Card, CardContent, Button, Tabs, Tab, Table, TableBody,
    TableCell, TableHead, TableRow, Chip, IconButton, Dialog, DialogTitle,
    DialogContent, DialogActions, TextField, MenuItem, Switch, FormControlLabel, Stack, Alert,
    Tooltip, LinearProgress, CircularProgress, Avatar, TablePagination
} from '@mui/material';
import {
    MonetizationOn as BillingIcon,
    Business as OrgIcon,
    VpnKey as KeyIcon,
    TrendingUp as StatsIcon,
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    ContentCopy as CopyIcon,
    CheckCircle as CheckIcon,
    Block as SuspendIcon,
    PlayArrow as ActivateIcon,
    Help as HelpIcon,
    Storage as StorageIcon,
    Chat as ChatIcon,
    AssignmentTurnedIn as ApprovalIcon,
    Search as SearchIcon,
    Close as CloseIcon,
    Visibility as VisibilityIcon,
    VisibilityOff as VisibilityOffIcon,
    CloudUpload as CloudUploadIcon,
    People as PeopleIcon,
    Hub as HubIcon
} from '@mui/icons-material';
import api from '../services/api';
import axios from 'axios';
import SubscriptionTierManager from '../components/billing/SubscriptionTierManager';
import ManagedUsersTab from '../components/billing/ManagedUsersTab';
import { useAuthStore } from '../store/authStore';
import { usePagination } from '../hooks/usePagination';

const BYTES_PER_GB = 1024 ** 3;

// 'Custom' is a mode, not a stored tier: it tells the form to keep whatever the
// admin typed instead of overwriting it with a preset.
const CUSTOM_PLAN = 'Custom';

// Sentinel for the stat card's "no tier filter" state. Not a plan name, so it
// cannot collide with one an admin creates.
const ALL_TIERS = '__all__';

const getNotionChipSx = (type) => {
    switch (type) {
        case 'Enterprise': return { bgcolor: '#F4EEEE', color: '#7828C8', fontWeight: 600, border: 'none', borderRadius: 1 };
        case 'Pro': return { bgcolor: '#E7F3F8', color: '#1879B5', fontWeight: 600, border: 'none', borderRadius: 1 };
        case 'Starter':
        case 'Free': return { bgcolor: '#F1F1EF', color: '#5A5A58', fontWeight: 600, border: 'none', borderRadius: 1 };
        case 'active':
        case 'available': return { bgcolor: '#EDF3EC', color: '#2B593F', fontWeight: 600, border: 'none', borderRadius: 1 };
        case 'suspended': return { bgcolor: '#FDEBEB', color: '#D44C47', fontWeight: 600, border: 'none', borderRadius: 1 };
        case 'redeemed': return { bgcolor: '#F1F1EF', color: '#787774', fontWeight: 600, border: 'none', borderRadius: 1 };
        default: return { bgcolor: '#F1F1EF', color: '#37352F', fontWeight: 600, border: 'none', borderRadius: 1 };
    }
};

export default function BillingManagementPage() {
    const queryClient = useQueryClient();
    const [tabIndex, setTabIndex] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [stats, setStats] = useState(null);
    const [orgs, setOrgs] = useState([]);
    const [licenses, setLicenses] = useState([]);
    const [tiers, setTiers] = useState([]);
    const [statPlanFilter, setStatPlanFilter] = useState(ALL_TIERS);
    const [managedUsers, setManagedUsers] = useState([]);
    const currentUser = useAuthStore(state => state.user);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const filteredOrgs = (orgs || []).filter(o => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (o.name && o.name.toLowerCase().includes(q)) ||
               (o.owner_email && o.owner_email.toLowerCase().includes(q)) ||
               (o.owner_name && o.owner_name.toLowerCase().includes(q));
    });

    // Paginate the filtered list, so paging reflects the active search.
    const orgPagination = usePagination(filteredOrgs, 10);

    const filteredLicenses = (licenses || []).filter(lic => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (lic.owner_email && lic.owner_email.toLowerCase().includes(q)) ||
               (lic.license_key && lic.license_key.toLowerCase().includes(q)) ||
               (lic.plan_name && lic.plan_name.toLowerCase().includes(q));
    });

    // Modal state for Editing Org
    const [editOrgModal, setEditOrgModal] = useState(false);
    const [selectedOrg, setSelectedOrg] = useState(null);

    // An organization redeemed from a licence carries its own entitlement; one
    // the owner created afterwards inherits it. Editing quotas on the derived
    // one would be misleading — the inherited values are recomputed from the
    // plan whenever another organization is created.
    const isInheritedOrg = selectedOrg ? selectedOrg.is_licensed === false : false;

    const [editPlanType, setEditPlanType] = useState('Pro');
    const [editStorageGB, setEditStorageGB] = useState(100);
    const [editMaxMembers, setEditMaxMembers] = useState(25);
    const [editMemberStorageGB, setEditMemberStorageGB] = useState(20);
    const [editMaxOrgs, setEditMaxOrgs] = useState(3);
    const [editChat, setEditChat] = useState(true);
    const [editApproval, setEditApproval] = useState(true);
    const [editIntegration, setEditIntegration] = useState(false);
    const [editCrm, setEditCrm] = useState(false);
    const [editCrmBoards, setEditCrmBoards] = useState(0);
    const [editCrmRecords, setEditCrmRecords] = useState(0);

    // Declared after the state it reads: a const cannot be referenced before
    // its initializer runs, and placing this above threw on every render.
    //
    // billingService rejects a per-member cap above the organization's total,
    // which leaves an already-inconsistent organization unsaveable until one of
    // the two is corrected. Surfaced before submitting rather than as a 400.
    const memberCapExceedsTotal =
        Number(editMemberStorageGB) > 0
        && Number(editStorageGB) > 0
        && Number(editMemberStorageGB) > Number(editStorageGB);
    const [editGmtLocation, setEditGmtLocation] = useState('GMT+7 (Asia/Jakarta / Bangkok - WIB)');
    const [editCustomAppTitle, setEditCustomAppTitle] = useState('');
    const [editCustomLogoUrl, setEditCustomLogoUrl] = useState('');
    const [editNotes, setEditNotes] = useState('');

    // Form state for New License Key
    const [newOwnerEmail, setNewOwnerEmail] = useState('');
    const [newPlanType, setNewPlanType] = useState('Pro');
    const [newStorageGB, setNewStorageGB] = useState(100);
    const [newMaxMembers, setNewMaxMembers] = useState(25);
    const [newMemberStorageGB, setNewMemberStorageGB] = useState(20);
    const [newMaxOrgs, setNewMaxOrgs] = useState(3);
    const [newChat, setNewChat] = useState(true);
    const [newApproval, setNewApproval] = useState(true);
    // Integration exposes an API surface, so it is opted into rather than on by default.
    const [newIntegration, setNewIntegration] = useState(false);
    const [newCrm, setNewCrm] = useState(false);
    const [newCrmBoards, setNewCrmBoards] = useState(0);
    const [newCrmRecords, setNewCrmRecords] = useState(0);
    const [newGmtLocation, setNewGmtLocation] = useState('GMT+7 (Asia/Jakarta)');
    const [newCustomAppTitle, setNewCustomAppTitle] = useState('');
    const [newCustomLogoUrl, setNewCustomLogoUrl] = useState('');
    const [newCustomKey, setNewCustomKey] = useState('');
    const [generatingKey, setGeneratingKey] = useState(false);
    const [uploadingNewLogo, setUploadingNewLogo] = useState(false);
    const [uploadingEditLogo, setUploadingEditLogo] = useState(false);
    const [visibleKeys, setVisibleKeys] = useState({});

    const [copiedKey, setCopiedKey] = useState(null);

    const fetchData = async () => {
        setLoading(true);
        setError('');
        try {
            const [statsRes, orgsRes, licRes, tiersRes, usersRes] = await Promise.all([
                api.get('/billing/stats'),
                api.get('/billing/organizations'),
                api.get('/billing/licenses'),
                api.get('/billing/tiers'),
                api.get('/billing/users')
            ]);
            setStats(statsRes.data.data.stats || null);
            setOrgs(orgsRes.data.data.organizations || []);
            setLicenses(licRes.data.data.licenses || []);
            setTiers(tiersRes.data.data.tiers || []);
            setManagedUsers(usersRes.data.data.users || []);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to fetch billing data.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleCopy = (text) => {
        navigator.clipboard.writeText(text);
        setCopiedKey(text);
        setTimeout(() => setCopiedKey(null), 2000);
    };

    // Plans the stat card can filter by: every defined tier, plus any plan name
    // actually present on an organization but no longer defined as a tier
    // ('Custom', or a tier since deleted). Counting only what tiers exist would
    // silently hide organizations.
    const statPlanCounts = stats?.orgs_by_plan || [];
    const statPlanOptions = [
        ...tiers.map(t => ({ value: t.name, label: t.label || t.name })),
        ...statPlanCounts
            .filter(p => !tiers.some(t => t.name === p.plan_name))
            .map(p => ({ value: p.plan_name, label: p.plan_name }))
    ];
    const statPlanCount = statPlanFilter === ALL_TIERS
        ? statPlanCounts.reduce((sum, p) => sum + Number(p.count || 0), 0)
        : Number(statPlanCounts.find(p => p.plan_name === statPlanFilter)?.count || 0);
    const statPlanLabel = statPlanFilter === ALL_TIERS
        ? 'All Tiers'
        : (statPlanOptions.find(o => o.value === statPlanFilter)?.label || statPlanFilter);

    // One source for both tier dropdowns. `currentValue` may name a tier that
    // has since been deleted — an organization keeps its plan_name either way —
    // so it is appended as a disabled option rather than rendering as blank.
    const renderTierOptions = (currentValue) => {
        const options = tiers.map(t => (
            <MenuItem key={t.id} value={t.name}>
                {t.label || t.name} ({(Number(t.storage_limit_bytes) / BYTES_PER_GB).toLocaleString()} GB, {t.max_members} Members)
            </MenuItem>
        ));
        const isKnown = !currentValue
            || currentValue === CUSTOM_PLAN
            || tiers.some(t => t.name === currentValue);
        if (!isKnown) {
            options.push(
                <MenuItem key="__orphan" value={currentValue} disabled>
                    {currentValue} (tier no longer defined)
                </MenuItem>
            );
        }
        return options;
    };

    const handlePlanChange = (plan, isEdit = false) => {
        // Presets now come from the editable subscription_tiers table. An
        // unrecognised plan leaves the quota fields alone rather than
        // overwriting them with numbers from nowhere.
        const tier = tiers.find(t => t.name === plan);
        const st = tier ? Number(tier.storage_limit_bytes) / BYTES_PER_GB : null;
        const mem = tier ? tier.max_members : null;
        const memCap = tier ? Number(tier.member_storage_limit_bytes) / BYTES_PER_GB : null;
        const maxOrgs = tier ? tier.max_organizations : null;

        if (isEdit) {
            setEditPlanType(plan);
            if (tier) {
                setEditStorageGB(st);
                setEditMaxMembers(mem);
                setEditMemberStorageGB(memCap);
                setEditMaxOrgs(maxOrgs);
            }
        } else {
            setNewPlanType(plan);
            if (tier) {
                setNewStorageGB(st);
                setNewMaxMembers(mem);
                setNewMemberStorageGB(memCap);
                setNewMaxOrgs(maxOrgs);
            }
        }
    };

    const handleOpenEditModal = (org) => {
        setSelectedOrg(org);
        setEditPlanType(org.plan_name || 'Custom');
        setEditStorageGB(Math.round((org.storage_limit_bytes || 5368709120) / (1024 * 1024 * 1024)));
        setEditMaxMembers(org.max_members || 25);
        setEditMemberStorageGB(Math.round((org.member_storage_limit_bytes || 5368709120) / (1024 * 1024 * 1024)));
        setEditMaxOrgs(org.max_organizations ?? 1);
        setEditGmtLocation(org.gmt_location || 'GMT+7 (Asia/Jakarta / Bangkok - WIB)');
        setEditCustomAppTitle(org.custom_app_title || '');
        setEditCustomLogoUrl(org.custom_logo_url || '');
        setEditChat(org.feature_chat_enabled !== false);
        setEditApproval(org.feature_approval_enabled !== false);
        setEditIntegration(org.feature_integration_enabled === true);
        setEditCrm(org.feature_crm_enabled === true);
        setEditCrmBoards(org.crm_max_boards ?? 0);
        setEditCrmRecords(org.crm_max_records ?? 0);
        setEditNotes(org.admin_notes || '');
        setEditOrgModal(true);
    };

    const handleSaveOrgBilling = async () => {
        if (!selectedOrg) return;
        setError('');
        setSuccessMsg('');
        try {
            const res = await api.put(`/billing/organizations/${selectedOrg.id}`, {
                plan_name: editPlanType,
                storage_limit_gb: Number(editStorageGB),
                max_members: Number(editMaxMembers),
                member_storage_limit_gb: Number(editMemberStorageGB),
                max_organizations: Number(editMaxOrgs),
                gmt_location: editGmtLocation,
                custom_app_title: editCustomAppTitle ? editCustomAppTitle.trim() : null,
                custom_logo_url: editCustomLogoUrl ? editCustomLogoUrl.trim() : null,
                feature_chat_enabled: editChat,
                feature_approval_enabled: editApproval,
                feature_integration_enabled: editIntegration,
                feature_crm_enabled: editCrm,
                crm_max_boards: Number(editCrmBoards) || 0,
                crm_max_records: Number(editCrmRecords) || 0,
                admin_notes: editNotes
            });
            const propagated = res.data?.data?.organization?.propagated_to ?? [];
            setSuccessMsg(
                propagated.length > 0
                    ? `Updated ${selectedOrg.name}, and applied the same quotas to ${propagated.length} organization(s) that inherit from it: ${propagated.map(o => o.name).join(', ')}.`
                    : `Successfully updated quotas & features for ${selectedOrg.name}!`
            );
            setEditOrgModal(false);
            fetchData();
            queryClient.invalidateQueries(['organizations']);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update organization billing.');
        }
    };

    const handleToggleOrgStatus = async (org) => {
        const newStatus = org.status === 'suspended' ? 'active' : 'suspended';
        try {
            await api.put(`/billing/organizations/${org.id}/status`, { status: newStatus });
            setSuccessMsg(`Organization ${org.name} is now ${newStatus.toUpperCase()}`);
            fetchData();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to change status.');
        }
    };

    const handleDeleteOrg = async (org) => {
        if (!window.confirm(`Are you sure you want to delete ${org.name} and ALL its members and files? This cannot be undone.`)) return;
        try {
            await api.delete(`/billing/organizations/${org.id}`);
            setSuccessMsg(`Deleted organization: ${org.name}`);
            fetchData();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to delete organization.');
        }
    };

    const handleCreateLicense = async (e) => {
        e.preventDefault();
        if (!newOwnerEmail || !newOwnerEmail.trim()) {
            alert('Prospective Owner Email address is required.');
            return;
        }
        setGeneratingKey(true);
        try {
            const storageBytes = newStorageGB * 1024 * 1024 * 1024;
            const memberStorageBytes = newMemberStorageGB * 1024 * 1024 * 1024;
            await api.post('/billing/licenses', {
                ownerEmail: newOwnerEmail,
                planName: newPlanType,
                storageLimitBytes: storageBytes,
                maxMembers: newMaxMembers,
                memberStorageLimitBytes: memberStorageBytes,
                maxOrganizations: Number(newMaxOrgs),
                featureChatEnabled: newChat,
                featureIntegrationEnabled: newIntegration,
                featureCrmEnabled: newCrm,
                crmMaxBoards: Number(newCrmBoards) || 0,
                crmMaxRecords: Number(newCrmRecords) || 0,
                featureApprovalEnabled: newApproval,
                gmtLocation: newGmtLocation,
                customAppTitle: newCustomAppTitle ? newCustomAppTitle.trim() : null,
                customLogoUrl: newCustomLogoUrl ? newCustomLogoUrl.trim() : null,
                customKey: newCustomKey ? newCustomKey.trim() : null
            });
            setSuccessMsg(`License Key generated and sent via Email to ${newOwnerEmail}!`);
            setNewOwnerEmail('');
            setNewCustomKey('');
            setNewCustomAppTitle('');
            setNewCustomLogoUrl('');
            fetchData();
            queryClient.invalidateQueries(['organizations']);
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to create license key.');
        } finally {
            setGeneratingKey(false);
        }
    };

    const handleDeleteLicense = async (id) => {
        if (!window.confirm('Delete this unused license key?')) return;
        try {
            await api.delete(`/billing/licenses/${id}`);
            setSuccessMsg('License key deleted.');
            fetchData();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to delete license key.');
        }
    };

    const toggleKeyVisibility = (id) => {
        setVisibleKeys(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const formatMaskedKey = (key) => {
        if (!key) return '';
        const parts = key.split('-');
        if (parts.length > 2) {
            const prefix = parts.slice(0, Math.min(3, parts.length - 1)).join('-');
            return `${prefix}-${'•'.repeat(20)}`;
        }
        return key.slice(0, 8) + '•'.repeat(20);
    };

    const handleUploadNewLogo = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingNewLogo(true);
        try {
            const { data: { data } } = await api.post('/storage/upload-branding-logo-url', {
                fileName: file.name
            });
            await axios.put(data.uploadUrl, file, {
                headers: { 'Content-Type': file.type || 'image/png' }
            });
            setNewCustomLogoUrl(data.downloadUrl || data.storageKey);
            alert('Logo uploaded successfully!');
        } catch (err) {
            console.error('Logo upload error:', err);
            alert(err.response?.data?.message || 'Failed to upload logo.');
        } finally {
            setUploadingNewLogo(false);
        }
    };

    const handleUploadEditLogo = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingEditLogo(true);
        try {
            const { data: { data } } = await api.post('/storage/upload-branding-logo-url', {
                fileName: file.name
            });
            await axios.put(data.uploadUrl, file, {
                headers: { 'Content-Type': file.type || 'image/png' }
            });
            setEditCustomLogoUrl(data.downloadUrl || data.storageKey);
            alert('Logo uploaded successfully!');
        } catch (err) {
            console.error('Logo upload error:', err);
            alert(err.response?.data?.message || 'Failed to upload logo.');
        } finally {
            setUploadingEditLogo(false);
        }
    };

    const formatBytesGB = (bytes) => {
        const val = parseInt(bytes || 0, 10);
        return (val / (1024 * 1024 * 1024)).toFixed(1);
    };

    return (
        <Box sx={{ p: { xs: 2, sm: 4 }, minHeight: '100vh', bgcolor: '#FFFFFF' }}>
            {/* ── Page Header ──────────────────────────────────────────────── */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <BillingIcon color="primary" sx={{ fontSize: 32 }} />
                    <Typography color="text.primary" sx={{ fontSize: '1.25rem', fontWeight: 700 }}>
                        Super Admin Billing Console
                    </Typography>
                </Box>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => setTabIndex(1)}>
                    Provision License Key
                </Button>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setError('')}>{error}</Alert>}
            {successMsg && <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setSuccessMsg('')}>{successMsg}</Alert>}

            {/* ── Telemetry Stats Slider / Carousel ────────────────────────── */}
            {stats && (
                <Box
                    sx={{
                        display: 'flex',
                        gap: 2,
                        overflowX: 'auto',
                        pb: 1.5,
                        mb: 3,
                        mx: -0.5,
                        px: 0.5,
                        '::-webkit-scrollbar': { height: 6 },
                        '::-webkit-scrollbar-thumb': { bgcolor: '#EAEAEA', borderRadius: 3 },
                        '::-webkit-scrollbar-track': { bgcolor: 'transparent' }
                    }}
                >
                    {[
                        { label: 'Total Organizations', icon: <OrgIcon sx={{ color: '#37352F', fontSize: 20 }} />, val: stats.total_orgs, sub: 'Registered workspaces' },
                        { label: statPlanLabel, icon: <StatsIcon sx={{ color: '#1879B5', fontSize: 20 }} />, val: statPlanCount, sub: 'Active workspaces on this tier', filterable: true },
                        { label: 'Storage Used', icon: <StorageIcon sx={{ color: '#7828C8', fontSize: 20 }} />, val: `${formatBytesGB(stats.total_used_bytes)} GB`, sub: 'Across all teams' },
                        { label: 'Total Capacity', icon: <StorageIcon sx={{ color: '#D44C47', fontSize: 20 }} />, val: `${formatBytesGB(stats.total_capacity_bytes)} GB`, sub: 'Allocated pool limit' },
                        { label: 'Active Licenses', icon: <KeyIcon sx={{ color: '#2B593F', fontSize: 20 }} />, val: stats.available_licenses, sub: 'Unredeemed keys' }
                    ].map((item, idx) => (
                        <Card
                            key={idx}
                            variant="outlined"
                            sx={{
                                minWidth: { xs: 220, sm: 240, md: 260 },
                                flex: '1 0 auto',
                                p: 2.5,
                                borderRadius: 3,
                                bgcolor: '#F7F7F5',
                                borderColor: '#EAEAEA',
                                transition: 'all 0.2s ease-in-out',
                                '&:hover': {
                                    bgcolor: '#FFFFFF',
                                    borderColor: '#CCCCCC',
                                    boxShadow: '0 6px 16px rgba(55,53,47,0.06)',
                                    transform: 'translateY(-2px)'
                                }
                            }}
                        >
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                                <Typography variant="caption" fontWeight={700} sx={{ color: '#73726E', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                                    {item.label}
                                </Typography>
                                <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: '#EAEAEA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {item.icon}
                                </Box>
                            </Box>
                            <Typography variant="h4" fontWeight={800} sx={{ color: '#37352F', mb: 0.5, fontSize: '1.65rem' }}>
                                {item.val}
                            </Typography>
                            {item.filterable && (
                                <TextField
                                    select
                                    size="small"
                                    variant="standard"
                                    value={statPlanFilter}
                                    onChange={(e) => setStatPlanFilter(e.target.value)}
                                    sx={{ mb: 0.5, minWidth: 140, '& .MuiInputBase-input': { fontSize: '0.75rem', py: 0.25 } }}
                                >
                                    <MenuItem value={ALL_TIERS}>All Tiers</MenuItem>
                                    {statPlanOptions.map(opt => (
                                        <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                                    ))}
                                </TextField>
                            )}
                            <Typography variant="caption" sx={{ color: '#73726E', fontWeight: 500, display: 'block' }}>
                                {item.sub}
                            </Typography>
                        </Card>
                    ))}
                </Box>
            )}

            {/* ── Navigation Tabs ──────────────────────────────────────────── */}
            <Tabs value={tabIndex} onChange={(e, val) => { setTabIndex(val); setSearchQuery(''); }} sx={{ mb: 3, borderBottom: '1px solid #EAEAEA', '& .MuiTab-root': { fontWeight: 600, color: '#73726E', textTransform: 'none' }, '& .Mui-selected': { color: '#37352F !important', fontWeight: 700 } }}>
                <Tab icon={<OrgIcon fontSize="small" />} iconPosition="start" label={`Organizations Manager (${orgs.length})`} />
                <Tab icon={<KeyIcon fontSize="small" />} iconPosition="start" label={`License Key Studio (${licenses.length})`} />
                <Tab icon={<StorageIcon fontSize="small" />} iconPosition="start" label={`Subscription Tiers (${tiers.length})`} />
                <Tab icon={<PeopleIcon fontSize="small" />} iconPosition="start" label={`Managed Users (${managedUsers.length})`} />
                <Tab icon={<HelpIcon fontSize="small" />} iconPosition="start" label="Monetization Hub" />
            </Tabs>

            {/* ── TAB 0: Organizations Manager ─────────────────────────────── */}
            {tabIndex === 0 && (
                <Box sx={{ flex: 1, overflowY: 'auto' }}>
                    <Card variant="outlined" sx={{ borderRadius: 3 }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 2 }}>
                                <Typography variant="h6" fontWeight="bold" sx={{ color: '#37352F' }}>
                                    Registered Organizations ({filteredOrgs.length})
                                </Typography>
                                <TextField
                                    size="small"
                                    placeholder="Search by email or organization..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    InputProps={{
                                        startAdornment: <SearchIcon sx={{ color: '#73726E', mr: 1, fontSize: 20 }} />,
                                        endAdornment: searchQuery ? (
                                            <IconButton size="small" onClick={() => setSearchQuery('')}>
                                                <CloseIcon fontSize="small" sx={{ fontSize: 16 }} />
                                            </IconButton>
                                        ) : null
                                    }}
                                    sx={{ width: { xs: '100%', sm: 320 }, '& .MuiOutlinedInput-root': { bgcolor: '#F7F7F5', borderRadius: 2 } }}
                                />
                            </Box>
                            <Table>
                                <TableHead sx={{ bgcolor: '#F7F7F5', '& th': { color: '#73726E', fontWeight: 600, fontSize: '0.8rem', borderBottom: '1px solid #EAEAEA' } }}>
                                    <TableRow>
                                        <TableCell>Organization Name</TableCell>
                                        <TableCell>Owner</TableCell>
                                        <TableCell>Plan Tier</TableCell>
                                        <TableCell>Members</TableCell>
                                        <TableCell>Per-Member Cap</TableCell>
                                        <TableCell>Storage Usage</TableCell>
                                        <TableCell>Features</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell align="right">Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {filteredOrgs.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={9} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                                                {searchQuery ? 'No organizations match your search.' : 'No organizations registered yet.'}
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        orgPagination.paginated.map((o) => {
                                            const usedGB = parseFloat(formatBytesGB(o.storage_used_bytes));
                                            const limitGB = parseFloat(formatBytesGB(o.storage_limit_bytes || 5368709120));
                                            const storagePct = Math.min(100, Math.round((usedGB / limitGB) * 100)) || 0;
                                            const memberPct = Math.min(100, Math.round((o.member_count / (o.max_members || 5)) * 100)) || 0;

                                            return (
                                                <TableRow key={o.id} hover>
                                                    <TableCell sx={{ fontWeight: 700, color: 'text.primary' }}>{o.name}</TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2" fontWeight={600}>{o.owner_name || 'Unknown'}</Typography>
                                                        <Typography variant="caption" color="text.secondary">{o.owner_email}</Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Chip
                                                            label={o.plan_name || 'Free'}
                                                            size="small"
                                                            sx={getNotionChipSx(o.plan_name || 'Free')}
                                                        />
                                                        {o.gmt_location && (
                                                            <Chip
                                                                label={`🌍 ${o.gmt_location}`}
                                                                size="small"
                                                                sx={{ mt: 0.5, bgcolor: '#F1F1EF', color: '#37352F', fontSize: '0.65rem', height: 20, display: 'flex', width: 'fit-content' }}
                                                            />
                                                        )}
                                                    </TableCell>
                                                    <TableCell sx={{ minWidth: 130 }}>
                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                                            <Typography variant="caption" fontWeight={700}>{o.member_count} / {o.max_members}</Typography>
                                                            <Typography variant="caption" color="text.secondary">{memberPct}%</Typography>
                                                        </Box>
                                                        <LinearProgress variant="determinate" value={memberPct} sx={{ height: 6, borderRadius: 3 }} />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2" fontWeight={700}>
                                                            {parseFloat(formatBytesGB(o.member_storage_limit_bytes || 5368709120))} GB
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary">max per role</Typography>
                                                    </TableCell>
                                                    <TableCell sx={{ minWidth: 140 }}>
                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                                            <Typography variant="caption" fontWeight={700}>{usedGB} / {limitGB} GB</Typography>
                                                            <Typography variant="caption" color="text.secondary">{storagePct}%</Typography>
                                                        </Box>
                                                        <LinearProgress variant="determinate" value={storagePct} color={storagePct > 85 ? 'error' : 'primary'} sx={{ height: 6, borderRadius: 3 }} />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Stack direction="row" spacing={0.5}>
                                                            <Tooltip title={`Chat: ${o.feature_chat_enabled !== false ? 'Enabled' : 'Disabled'}`}>
                                                                <Chip icon={<ChatIcon sx={{ fontSize: 14, color: 'inherit !important' }} />} label="Chat" size="small" sx={o.feature_chat_enabled !== false ? { bgcolor: '#EDF3EC', color: '#2B593F', fontWeight: 600, border: 'none', borderRadius: 1, height: 22, fontSize: '0.7rem' } : { bgcolor: '#F1F1EF', color: '#73726E', fontWeight: 500, border: 'none', borderRadius: 1, height: 22, fontSize: '0.7rem' }} />
                                                            </Tooltip>
                                                            <Tooltip title={`Integration API: ${o.feature_integration_enabled === true ? 'Enabled' : 'Disabled'}`}>
                                                                <Chip icon={<HubIcon sx={{ fontSize: 14, color: 'inherit !important' }} />} label="API" size="small" sx={o.feature_integration_enabled === true ? { bgcolor: '#EDF3EC', color: '#2B593F', fontWeight: 600, border: 'none', borderRadius: 1, height: 22, fontSize: '0.7rem' } : { bgcolor: '#F1F1EF', color: '#73726E', fontWeight: 500, border: 'none', borderRadius: 1, height: 22, fontSize: '0.7rem' }} />
                                                            </Tooltip>
                                                            <Tooltip title={`Approvals: ${o.feature_approval_enabled !== false ? 'Enabled' : 'Disabled'}`}>
                                                                <Chip icon={<ApprovalIcon sx={{ fontSize: 14, color: 'inherit !important' }} />} label="Appr" size="small" sx={o.feature_approval_enabled !== false ? { bgcolor: '#EDF3EC', color: '#2B593F', fontWeight: 600, border: 'none', borderRadius: 1, height: 22, fontSize: '0.7rem' } : { bgcolor: '#F1F1EF', color: '#73726E', fontWeight: 500, border: 'none', borderRadius: 1, height: 22, fontSize: '0.7rem' }} />
                                                            </Tooltip>
                                                        </Stack>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Chip
                                                            label={(o.status || 'active').toUpperCase()}
                                                            size="small"
                                                            sx={getNotionChipSx(o.status || 'active')}
                                                        />
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                                                            <Tooltip title="Edit Quotas & Features">
                                                                <IconButton size="small" onClick={() => handleOpenEditModal(o)}>
                                                                    <EditIcon fontSize="small" />
                                                                </IconButton>
                                                            </Tooltip>
                                                            <Tooltip title={o.status === 'suspended' ? 'Activate Organization' : 'Suspend Organization'}>
                                                                <IconButton size="small" color={o.status === 'suspended' ? 'success' : 'error'} onClick={() => handleToggleOrgStatus(o)}>
                                                                    {o.status === 'suspended' ? <ActivateIcon fontSize="small" /> : <SuspendIcon fontSize="small" />}
                                                                </IconButton>
                                                            </Tooltip>
                                                            <Tooltip title="Delete Organization">
                                                                <IconButton size="small" color="error" onClick={() => handleDeleteOrg(o)}>
                                                                    <DeleteIcon fontSize="small" />
                                                                </IconButton>
                                                            </Tooltip>
                                                        </Stack>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                            <TablePagination
                                component="div"
                                count={orgPagination.count}
                                page={orgPagination.page}
                                onPageChange={orgPagination.handlePageChange}
                                rowsPerPage={orgPagination.rowsPerPage}
                                onRowsPerPageChange={orgPagination.handleRowsPerPageChange}
                                rowsPerPageOptions={[5, 10, 25, 50]}
                            />
                        </CardContent>
                    </Card>
                </Box>
            )}

            {/* ── TAB 1: License Key Studio ────────────────────────────────── */}
            {tabIndex === 1 && (
                <Grid container spacing={3}>
                    <Grid item xs={12} md={4}>
                        <Card variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                            <CardContent>
                                <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <KeyIcon color="primary" /> Provision License Key
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                                    Assign an activation key to a prospective Organization Owner. They will receive an email with registration instructions.
                                </Typography>

                                <form onSubmit={handleCreateLicense}>
                                    <TextField
                                        label="Prospective Owner Email"
                                        type="email"
                                        fullWidth
                                        required
                                        size="small"
                                        placeholder="client-ceo@acme.com"
                                        value={newOwnerEmail}
                                        onChange={(e) => setNewOwnerEmail(e.target.value)}
                                        sx={{ mb: 2.5 }}
                                    />

                                    <TextField
                                        select
                                        label="Subscription Tier Mode"
                                        fullWidth
                                        size="small"
                                        value={newPlanType}
                                        onChange={(e) => handlePlanChange(e.target.value, false)}
                                        sx={{ mb: 2.5 }}
                                    >
                                        {renderTierOptions(newPlanType)}
                                        <MenuItem value={CUSTOM_PLAN}>⚡ Custom Quotas & Limits</MenuItem>
                                    </TextField>

                                    <TextField
                                        select
                                        label="GMT Location Timezone"
                                        fullWidth
                                        size="small"
                                        value={newGmtLocation}
                                        onChange={(e) => setNewGmtLocation(e.target.value)}
                                        sx={{ mb: 2.5 }}
                                    >
                                        <MenuItem value="GMT-12:00 (International Date Line West)">GMT-12:00 (International Date Line West)</MenuItem>
                                        <MenuItem value="GMT-11:00 (Niue / Midway Island / Samoa)">GMT-11:00 (Niue / Midway Island / Samoa)</MenuItem>
                                        <MenuItem value="GMT-10:00 (Hawaii-Aleutian / Honolulu)">GMT-10:00 (Hawaii-Aleutian / Honolulu)</MenuItem>
                                        <MenuItem value="GMT-09:30 (Marquesas Islands)">GMT-09:30 (Marquesas Islands)</MenuItem>
                                        <MenuItem value="GMT-09:00 (Alaska / Anchorage)">GMT-09:00 (Alaska / Anchorage)</MenuItem>
                                        <MenuItem value="GMT-08:00 (America/Los_Angeles / PST / Vancouver)">GMT-08:00 (America/Los_Angeles / PST / Vancouver)</MenuItem>
                                        <MenuItem value="GMT-07:00 (America/Denver / MST / Phoenix)">GMT-07:00 (America/Denver / MST / Phoenix)</MenuItem>
                                        <MenuItem value="GMT-06:00 (America/Chicago / CST / Mexico City)">GMT-06:00 (America/Chicago / CST / Mexico City)</MenuItem>
                                        <MenuItem value="GMT-05:00 (America/New_York / EST / Toronto / Bogota)">GMT-05:00 (America/New_York / EST / Toronto / Bogota)</MenuItem>
                                        <MenuItem value="GMT-04:00 (Atlantic Time / Caracas / Santiago / San Juan)">GMT-04:00 (Atlantic Time / Caracas / Santiago / San Juan)</MenuItem>
                                        <MenuItem value="GMT-03:30 (Newfoundland / St. John's)">GMT-03:30 (Newfoundland / St. John's)</MenuItem>
                                        <MenuItem value="GMT-03:00 (Brasilia / Buenos Aires / Montevideo)">GMT-03:00 (Brasilia / Buenos Aires / Montevideo)</MenuItem>
                                        <MenuItem value="GMT-02:00 (Mid-Atlantic / Fernando de Noronha)">GMT-02:00 (Mid-Atlantic / Fernando de Noronha)</MenuItem>
                                        <MenuItem value="GMT-01:00 (Azores / Cape Verde Islands)">GMT-01:00 (Azores / Cape Verde Islands)</MenuItem>
                                        <MenuItem value="GMT+00:00 (UTC / Europe/London / Dublin / Lisbon)">GMT+00:00 (UTC / Europe/London / Dublin / Lisbon)</MenuItem>
                                        <MenuItem value="GMT+01:00 (Europe/Paris / Berlin / Rome / Madrid)">GMT+01:00 (Europe/Paris / Berlin / Rome / Madrid)</MenuItem>
                                        <MenuItem value="GMT+02:00 (Cairo / Johannesburg / Athens / Jerusalem / Kyiv)">GMT+02:00 (Cairo / Johannesburg / Athens / Jerusalem / Kyiv)</MenuItem>
                                        <MenuItem value="GMT+03:00 (Moscow / Istanbul / Riyadh / Nairobi / Doha)">GMT+03:00 (Moscow / Istanbul / Riyadh / Nairobi / Doha)</MenuItem>
                                        <MenuItem value="GMT+03:30 (Tehran - IRST)">GMT+03:30 (Tehran - IRST)</MenuItem>
                                        <MenuItem value="GMT+04:00 (Asia/Dubai / Abu Dhabi / Baku / Tbilisi)">GMT+04:00 (Asia/Dubai / Abu Dhabi / Baku / Tbilisi)</MenuItem>
                                        <MenuItem value="GMT+04:30 (Kabul - AFT)">GMT+04:30 (Kabul - AFT)</MenuItem>
                                        <MenuItem value="GMT+05:00 (Karachi / Tashkent / Maldives)">GMT+05:00 (Karachi / Tashkent / Maldives)</MenuItem>
                                        <MenuItem value="GMT+05:30 (India Standard Time / Mumbai / New Delhi)">GMT+05:30 (India Standard Time / Mumbai / New Delhi)</MenuItem>
                                        <MenuItem value="GMT+05:45 (Nepal / Kathmandu)">GMT+05:45 (Nepal / Kathmandu)</MenuItem>
                                        <MenuItem value="GMT+06:00 (Dhaka / Almaty / Omsk)">GMT+06:00 (Dhaka / Almaty / Omsk)</MenuItem>
                                        <MenuItem value="GMT+06:30 (Myanmar / Yangon / Cocos Islands)">GMT+06:30 (Myanmar / Yangon / Cocos Islands)</MenuItem>
                                        <MenuItem value="GMT+07:00 (Asia/Jakarta / Bangkok / Hanoi - WIB)">GMT+07:00 (Asia/Jakarta / Bangkok / Hanoi - WIB)</MenuItem>
                                        <MenuItem value="GMT+08:00 (Asia/Singapore / KL / HK / Beijing / WITA)">GMT+08:00 (Asia/Singapore / KL / HK / Beijing / WITA)</MenuItem>
                                        <MenuItem value="GMT+08:45 (Australia/Eucla - ACWST)">GMT+08:45 (Australia/Eucla - ACWST)</MenuItem>
                                        <MenuItem value="GMT+09:00 (Asia/Tokyo / Seoul / Yakutsk / WIT - Jayapura)">GMT+09:00 (Asia/Tokyo / Seoul / Yakutsk / WIT - Jayapura)</MenuItem>
                                        <MenuItem value="GMT+09:30 (Australia/Adelaide / Darwin - ACST)">GMT+09:30 (Australia/Adelaide / Darwin - ACST)</MenuItem>
                                        <MenuItem value="GMT+10:00 (Australia/Sydney / Melbourne / Brisbane / AEST)">GMT+10:00 (Australia/Sydney / Melbourne / Brisbane / AEST)</MenuItem>
                                        <MenuItem value="GMT+10:30 (Lord Howe Island)">GMT+10:30 (Lord Howe Island)</MenuItem>
                                        <MenuItem value="GMT+11:00 (Solomon Islands / New Caledonia / Magadan)">GMT+11:00 (Solomon Islands / New Caledonia / Magadan)</MenuItem>
                                        <MenuItem value="GMT+12:00 (New Zealand / Auckland / Fiji)">GMT+12:00 (New Zealand / Auckland / Fiji)</MenuItem>
                                        <MenuItem value="GMT+12:45 (Chatham Islands)">GMT+12:45 (Chatham Islands)</MenuItem>
                                        <MenuItem value="GMT+13:00 (Samoa / Tonga / Phoenix Islands)">GMT+13:00 (Samoa / Tonga / Phoenix Islands)</MenuItem>
                                        <MenuItem value="GMT+14:00 (Line Islands / Kiritimati)">GMT+14:00 (Line Islands / Kiritimati)</MenuItem>
                                    </TextField>

                                    {newPlanType === 'Custom' && (
                                        <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 2, mb: 2.5, border: '1px dashed', borderColor: 'divider' }}>
                                            <Typography variant="caption" fontWeight="bold" color="primary" sx={{ display: 'block', mb: 1.5 }}>
                                                CUSTOM LIMIT CONFIGURATION
                                            </Typography>
                                            <Grid container spacing={1.5}>
                                                <Grid item xs={12} sm={4}>
                                                    <TextField
                                                        label="Total Storage (GB)"
                                                        type="number"
                                                        fullWidth
                                                        size="small"
                                                        value={newStorageGB}
                                                        onChange={(e) => setNewStorageGB(e.target.value)}
                                                    />
                                                </Grid>
                                                <Grid item xs={12} sm={4}>
                                                    <TextField
                                                        label="Max Members"
                                                        type="number"
                                                        fullWidth
                                                        size="small"
                                                        value={newMaxMembers}
                                                        onChange={(e) => setNewMaxMembers(e.target.value)}
                                                    />
                                                </Grid>
                                                <Grid item xs={12} sm={4}>
                                                    <TextField
                                                        label="Max Organizations"
                                                        type="number"
                                                        fullWidth
                                                        size="small"
                                                        helperText="Orgs this owner may create"
                                                        value={newMaxOrgs}
                                                        onChange={(e) => setNewMaxOrgs(e.target.value)}
                                                    />
                                                </Grid>
                                                <Grid item xs={12} sm={4}>
                                                    <TextField
                                                        label="Per-Member Cap (GB)"
                                                        type="number"
                                                        fullWidth
                                                        size="small"
                                                        value={newMemberStorageGB}
                                                        onChange={(e) => setNewMemberStorageGB(e.target.value)}
                                                    />
                                                </Grid>
                                            </Grid>
                                        </Box>
                                    )}

                                    <Box sx={{ mb: 2.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
                                        <FormControlLabel
                                            control={<Switch checked={newChat} onChange={(e) => setNewChat(e.target.checked)} color="primary" />}
                                            label={<Typography variant="body2" fontWeight={600}>Enable Team Chat</Typography>}
                                        />
                                        <FormControlLabel
                                            control={<Switch checked={newApproval} onChange={(e) => setNewApproval(e.target.checked)} color="primary" />}
                                            label={<Typography variant="body2" fontWeight={600}>Enable Approval Workflows</Typography>}
                                        />
                                        <FormControlLabel
                                            control={<Switch checked={newIntegration} onChange={(e) => setNewIntegration(e.target.checked)} color="primary" />}
                                            label={<Typography variant="body2" fontWeight={600}>Enable Integration (API keys)</Typography>}
                                        />
                                        <FormControlLabel
                                            control={<Switch checked={newCrm} onChange={(e) => setNewCrm(e.target.checked)} color="primary" />}
                                            label={<Typography variant="body2" fontWeight={600}>Enable AbuGreySoft CRM</Typography>}
                                        />
                                        {newCrm && (
                                            <Stack direction="row" spacing={1.5} sx={{ pl: 5 }}>
                                                <TextField label="Max CRM Tables" type="number" size="small" fullWidth
                                                    value={newCrmBoards} onChange={(e) => setNewCrmBoards(e.target.value)} />
                                                <TextField label="Max CRM Records" type="number" size="small" fullWidth
                                                    value={newCrmRecords} onChange={(e) => setNewCrmRecords(e.target.value)} />
                                            </Stack>
                                        )}
                                    </Box>

                                    <Box sx={{ mb: 2.5, p: 2, bgcolor: 'action.hover', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                                        <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                                            CUSTOM BRANDING (WHITELABEL)
                                        </Typography>
                                        <TextField
                                            label="Custom Application Title"
                                            fullWidth
                                            size="small"
                                            placeholder="e.g. Acme Cloud Storage"
                                            value={newCustomAppTitle}
                                            onChange={(e) => setNewCustomAppTitle(e.target.value)}
                                            sx={{ mb: 2 }}
                                            helperText="Overrides default AbuGreySoft Box title for this workspace"
                                        />
                                        <Box>
                                            <TextField
                                                label="Custom Logo URL (Image Link)"
                                                fullWidth
                                                size="small"
                                                placeholder="https://example.com/logo.png"
                                                value={newCustomLogoUrl}
                                                onChange={(e) => setNewCustomLogoUrl(e.target.value)}
                                                helperText="URL to custom logo image or upload directly below"
                                            />
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
                                                <Button
                                                    component="label"
                                                    variant="outlined"
                                                    size="small"
                                                    startIcon={uploadingNewLogo ? <CircularProgress size={16} /> : <CloudUploadIcon />}
                                                    disabled={uploadingNewLogo}
                                                    sx={{ borderRadius: 2, textTransform: 'none', borderColor: '#D3D1CB', color: '#37352F', bgcolor: 'white', '&:hover': { bgcolor: '#F1F1EF' } }}
                                                >
                                                    {uploadingNewLogo ? 'Uploading...' : 'Upload Logo Image'}
                                                    <input type="file" accept="image/*" hidden onChange={handleUploadNewLogo} />
                                                </Button>
                                                {newCustomLogoUrl && (
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <Avatar src={newCustomLogoUrl} alt="Logo preview" sx={{ width: 28, height: 28, border: '1px solid #EAEAEA', bgcolor: 'transparent' }} />
                                                        <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 600 }}>
                                                            Logo ready
                                                        </Typography>
                                                    </Box>
                                                )}
                                            </Box>
                                        </Box>
                                    </Box>

                                    <TextField
                                        label="Custom Key String (Optional)"
                                        fullWidth
                                        size="small"
                                        placeholder="e.g. ACME-SPECIAL-2026"
                                        value={newCustomKey}
                                        onChange={(e) => setNewCustomKey(e.target.value)}
                                        sx={{ mb: 3 }}
                                        helperText="Leave blank for auto-generated secure code"
                                    />

                                    <Button
                                        type="submit"
                                        variant="contained"
                                        fullWidth
                                        disabled={generatingKey}
                                    >
                                        {generatingKey ? 'Provisioning...' : 'Generate & Email Key'}
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    </Grid>

                    <Grid item xs={12} md={8}>
                        <Card variant="outlined" sx={{ borderRadius: 3 }}>
                            <CardContent>
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 2 }}>
                                    <Typography variant="h6" fontWeight="bold" sx={{ color: '#37352F' }}>
                                        Provisioned Activation Keys ({filteredLicenses.length})
                                    </Typography>
                                    <TextField
                                        size="small"
                                        placeholder="Search by owner email or key..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        InputProps={{
                                            startAdornment: <SearchIcon sx={{ color: '#73726E', mr: 1, fontSize: 20 }} />,
                                            endAdornment: searchQuery ? (
                                                <IconButton size="small" onClick={() => setSearchQuery('')}>
                                                    <CloseIcon fontSize="small" sx={{ fontSize: 16 }} />
                                                </IconButton>
                                            ) : null
                                        }}
                                        sx={{ width: { xs: '100%', sm: 300 }, '& .MuiOutlinedInput-root': { bgcolor: '#F7F7F5', borderRadius: 2 } }}
                                    />
                                </Box>
                                <Table>
                                    <TableHead sx={{ bgcolor: '#F7F7F5', '& th': { color: '#73726E', fontWeight: 600, fontSize: '0.8rem', borderBottom: '1px solid #EAEAEA' } }}>
                                        <TableRow>
                                            <TableCell>License Key</TableCell>
                                            <TableCell>Assigned Owner Email</TableCell>
                                            <TableCell>Plan / Quota</TableCell>
                                            <TableCell>Status</TableCell>
                                            <TableCell align="right">Actions</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {filteredLicenses.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                                                    {searchQuery ? 'No license keys match your search.' : 'No license keys generated yet.'}
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredLicenses.map((lic) => (
                                                <TableRow key={lic.id} hover>
                                                    <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700, color: 'primary.main' }}>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            <span>
                                                                {visibleKeys[lic.id] ? lic.license_key : formatMaskedKey(lic.license_key)}
                                                            </span>
                                                            <Tooltip title={visibleKeys[lic.id] ? "Hide License Key" : "Show License Key"}>
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() => toggleKeyVisibility(lic.id)}
                                                                    sx={{ color: '#73726E', padding: '2px', '&:hover': { bgcolor: '#EFEFED', color: '#37352F' } }}
                                                                >
                                                                    {visibleKeys[lic.id] ? <VisibilityOffIcon sx={{ fontSize: 16 }} /> : <VisibilityIcon sx={{ fontSize: 16 }} />}
                                                                </IconButton>
                                                            </Tooltip>
                                                        </Box>
                                                    </TableCell>
                                                    <TableCell sx={{ fontWeight: 600 }}>
                                                        {lic.owner_email}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2" fontWeight={700}>{lic.plan_name}</Typography>
                                                        <Typography variant="caption" color="text.secondary" display="block">
                                                            {formatBytesGB(lic.storage_limit_bytes)} GB · {lic.max_members} Users · Max {formatBytesGB(lic.member_storage_limit_bytes || 5368709120)} GB/role
                                                        </Typography>
                                                        {lic.gmt_location && (
                                                            <Chip
                                                                label={`🌍 ${lic.gmt_location}`}
                                                                size="small"
                                                                sx={{ mt: 0.5, bgcolor: '#F1F1EF', color: '#37352F', fontSize: '0.65rem', height: 20 }}
                                                            />
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Chip
                                                            label={(lic.status || 'available').toUpperCase()}
                                                            size="small"
                                                            sx={getNotionChipSx(lic.status || 'available')}
                                                        />
                                                        {lic.redeemed_org_name && (
                                                            <Typography variant="caption" display="block" sx={{ mt: 0.5, color: 'text.secondary' }}>
                                                                Org: {lic.redeemed_org_name}
                                                            </Typography>
                                                        )}
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                                                            <Tooltip title="Copy License Key">
                                                                <IconButton size="small" onClick={() => handleCopy(lic.license_key)}>
                                                                    {copiedKey === lic.license_key ? <CheckIcon fontSize="small" color="success" /> : <CopyIcon fontSize="small" />}
                                                                </IconButton>
                                                            </Tooltip>
                                                            {lic.status === 'available' && (
                                                                <Tooltip title="Delete Key">
                                                                    <IconButton size="small" color="error" onClick={() => handleDeleteLicense(lic.id)}>
                                                                        <DeleteIcon fontSize="small" />
                                                                    </IconButton>
                                                                </Tooltip>
                                                            )}
                                                        </Stack>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            )}

            {/* ── TAB 2: Subscription Tiers ────────────────────────────────── */}
            {tabIndex === 2 && (
                <SubscriptionTierManager tiers={tiers} onChanged={fetchData} />
            )}

            {/* ── TAB 3: Managed Users ─────────────────────────────────────── */}
            {tabIndex === 3 && (
                <ManagedUsersTab
                    users={managedUsers}
                    currentUserId={currentUser?.id}
                    onChanged={fetchData}
                />
            )}

            {/* ── TAB 4: Monetization Hub ──────────────────────────────────── */}
            {tabIndex === 4 && (
                <Box sx={{ maxWidth: 800 }}>
                    <Card variant="outlined" sx={{ p: 3, borderRadius: 3, mb: 3 }}>
                        <Typography variant="h6" fontWeight="bold" gutterBottom>
                            💡 1. How License Keys Work
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                            When you generate an Activation License Key in the studio above, you bind it to a prospective Organization Owner's email address. An automated invitation email is sent via <strong>Email</strong>. When the owner registers at <code>/register</code> using their License Key, their Organization is provisioned automatically with their assigned limits.
                        </Typography>
                    </Card>
                    <Card variant="outlined" sx={{ p: 3, borderRadius: 3, mb: 3 }}>
                        <Typography variant="h6" fontWeight="bold" gutterBottom>
                            👑 2. Hierarchical Quota Distribution
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                            The <strong>Total Organization Limit</strong> set by you (e.g. 100 GB) acts as a hard ceiling. Inside the Organization, the Owner allocates storage quotas to their Managers out of this 100 GB pool. Managers then allocate storage quotas to their subordinate staff members out of their assigned Manager quota, ensuring mathematical integrity across the entire team hierarchy.
                        </Typography>
                    </Card>
                    <Card variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
                        <Typography variant="h6" fontWeight="bold" gutterBottom>
                            🛑 3. Instant Feature Kill-Switches
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                            Toggling off <strong>Team Chat</strong> or <strong>Approval Workflows</strong> in the Organizations Manager immediately restricts API access for all members of that organization. Setting an organization status to <strong>Suspended</strong> acts as a global kill-switch, blocking file uploads and collaboration instantly without deleting their data.
                        </Typography>
                    </Card>
                </Box>
            )}

            {/* ── Edit Org Quotas Modal ────────────────────────────────────── */}
            <Dialog open={editOrgModal} onClose={() => setEditOrgModal(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3, p: 1 } }}>
                <DialogTitle sx={{ fontWeight: 'bold' }}>
                    Edit Quotas & Features: {selectedOrg?.name}
                </DialogTitle>
                <DialogContent>
                    {/* Repeated inside the dialog: the page-level alert renders
                        behind this modal, so a rejected save looked like nothing
                        happened at all. */}
                    {error && (
                        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError('')}>
                            {error}
                        </Alert>
                    )}
                    {memberCapExceedsTotal && (
                        <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
                            Per-Member Cap ({editMemberStorageGB} GB) is larger than Total Storage
                            ({editStorageGB} GB). The server rejects this, so no change can be saved until
                            one of the two is adjusted.
                        </Alert>
                    )}
                    <Box sx={{ mt: 1 }}>
                        <TextField
                            select
                            label="Subscription Plan Tier"
                            fullWidth
                            size="small"
                            value={editPlanType}
                            onChange={(e) => handlePlanChange(e.target.value, true)}
                            sx={{ mb: 3 }}
                        >
                            {renderTierOptions(editPlanType)}
                            <MenuItem value={CUSTOM_PLAN}>⚡ Custom Quotas & Limits</MenuItem>
                        </TextField>

                        <TextField
                            select
                            label="GMT Location Timezone"
                            fullWidth
                            size="small"
                            value={editGmtLocation}
                            onChange={(e) => setEditGmtLocation(e.target.value)}
                            sx={{ mb: 3 }}
                        >
                            <MenuItem value="GMT-12:00 (International Date Line West)">GMT-12:00 (International Date Line West)</MenuItem>
                            <MenuItem value="GMT-11:00 (Niue / Midway Island / Samoa)">GMT-11:00 (Niue / Midway Island / Samoa)</MenuItem>
                            <MenuItem value="GMT-10:00 (Hawaii-Aleutian / Honolulu)">GMT-10:00 (Hawaii-Aleutian / Honolulu)</MenuItem>
                            <MenuItem value="GMT-09:30 (Marquesas Islands)">GMT-09:30 (Marquesas Islands)</MenuItem>
                            <MenuItem value="GMT-09:00 (Alaska / Anchorage)">GMT-09:00 (Alaska / Anchorage)</MenuItem>
                            <MenuItem value="GMT-08:00 (America/Los_Angeles / PST / Vancouver)">GMT-08:00 (America/Los_Angeles / PST / Vancouver)</MenuItem>
                            <MenuItem value="GMT-07:00 (America/Denver / MST / Phoenix)">GMT-07:00 (America/Denver / MST / Phoenix)</MenuItem>
                            <MenuItem value="GMT-06:00 (America/Chicago / CST / Mexico City)">GMT-06:00 (America/Chicago / CST / Mexico City)</MenuItem>
                            <MenuItem value="GMT-05:00 (America/New_York / EST / Toronto / Bogota)">GMT-05:00 (America/New_York / EST / Toronto / Bogota)</MenuItem>
                            <MenuItem value="GMT-04:00 (Atlantic Time / Caracas / Santiago / San Juan)">GMT-04:00 (Atlantic Time / Caracas / Santiago / San Juan)</MenuItem>
                            <MenuItem value="GMT-03:30 (Newfoundland / St. John's)">GMT-03:30 (Newfoundland / St. John's)</MenuItem>
                            <MenuItem value="GMT-03:00 (Brasilia / Buenos Aires / Montevideo)">GMT-03:00 (Brasilia / Buenos Aires / Montevideo)</MenuItem>
                            <MenuItem value="GMT-02:00 (Mid-Atlantic / Fernando de Noronha)">GMT-02:00 (Mid-Atlantic / Fernando de Noronha)</MenuItem>
                            <MenuItem value="GMT-01:00 (Azores / Cape Verde Islands)">GMT-01:00 (Azores / Cape Verde Islands)</MenuItem>
                            <MenuItem value="GMT+00:00 (UTC / Europe/London / Dublin / Lisbon)">GMT+00:00 (UTC / Europe/London / Dublin / Lisbon)</MenuItem>
                            <MenuItem value="GMT+01:00 (Europe/Paris / Berlin / Rome / Madrid)">GMT+01:00 (Europe/Paris / Berlin / Rome / Madrid)</MenuItem>
                            <MenuItem value="GMT+02:00 (Cairo / Johannesburg / Athens / Jerusalem / Kyiv)">GMT+02:00 (Cairo / Johannesburg / Athens / Jerusalem / Kyiv)</MenuItem>
                            <MenuItem value="GMT+03:00 (Moscow / Istanbul / Riyadh / Nairobi / Doha)">GMT+03:00 (Moscow / Istanbul / Riyadh / Nairobi / Doha)</MenuItem>
                            <MenuItem value="GMT+03:30 (Tehran - IRST)">GMT+03:30 (Tehran - IRST)</MenuItem>
                            <MenuItem value="GMT+04:00 (Asia/Dubai / Abu Dhabi / Baku / Tbilisi)">GMT+04:00 (Asia/Dubai / Abu Dhabi / Baku / Tbilisi)</MenuItem>
                            <MenuItem value="GMT+04:30 (Kabul - AFT)">GMT+04:30 (Kabul - AFT)</MenuItem>
                            <MenuItem value="GMT+05:00 (Karachi / Tashkent / Maldives)">GMT+05:00 (Karachi / Tashkent / Maldives)</MenuItem>
                            <MenuItem value="GMT+05:30 (India Standard Time / Mumbai / New Delhi)">GMT+05:30 (India Standard Time / Mumbai / New Delhi)</MenuItem>
                            <MenuItem value="GMT+05:45 (Nepal / Kathmandu)">GMT+05:45 (Nepal / Kathmandu)</MenuItem>
                            <MenuItem value="GMT+06:00 (Dhaka / Almaty / Omsk)">GMT+06:00 (Dhaka / Almaty / Omsk)</MenuItem>
                            <MenuItem value="GMT+06:30 (Myanmar / Yangon / Cocos Islands)">GMT+06:30 (Myanmar / Yangon / Cocos Islands)</MenuItem>
                            <MenuItem value="GMT+07:00 (Asia/Jakarta / Bangkok / Hanoi - WIB)">GMT+07:00 (Asia/Jakarta / Bangkok / Hanoi - WIB)</MenuItem>
                            <MenuItem value="GMT+08:00 (Asia/Singapore / KL / HK / Beijing / WITA)">GMT+08:00 (Asia/Singapore / KL / HK / Beijing / WITA)</MenuItem>
                            <MenuItem value="GMT+08:45 (Australia/Eucla - ACWST)">GMT+08:45 (Australia/Eucla - ACWST)</MenuItem>
                            <MenuItem value="GMT+09:00 (Asia/Tokyo / Seoul / Yakutsk / WIT - Jayapura)">GMT+09:00 (Asia/Tokyo / Seoul / Yakutsk / WIT - Jayapura)</MenuItem>
                            <MenuItem value="GMT+09:30 (Australia/Adelaide / Darwin - ACST)">GMT+09:30 (Australia/Adelaide / Darwin - ACST)</MenuItem>
                            <MenuItem value="GMT+10:00 (Australia/Sydney / Melbourne / Brisbane / AEST)">GMT+10:00 (Australia/Sydney / Melbourne / Brisbane / AEST)</MenuItem>
                            <MenuItem value="GMT+10:30 (Lord Howe Island)">GMT+10:30 (Lord Howe Island)</MenuItem>
                            <MenuItem value="GMT+11:00 (Solomon Islands / New Caledonia / Magadan)">GMT+11:00 (Solomon Islands / New Caledonia / Magadan)</MenuItem>
                            <MenuItem value="GMT+12:00 (New Zealand / Auckland / Fiji)">GMT+12:00 (New Zealand / Auckland / Fiji)</MenuItem>
                            <MenuItem value="GMT+12:45 (Chatham Islands)">GMT+12:45 (Chatham Islands)</MenuItem>
                            <MenuItem value="GMT+13:00 (Samoa / Tonga / Phoenix Islands)">GMT+13:00 (Samoa / Tonga / Phoenix Islands)</MenuItem>
                            <MenuItem value="GMT+14:00 (Line Islands / Kiritimati)">GMT+14:00 (Line Islands / Kiritimati)</MenuItem>
                        </TextField>

                        <Box sx={{ mb: 3, p: 2, bgcolor: 'action.hover', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                            <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                                CUSTOM BRANDING (WHITELABEL)
                            </Typography>
                            <TextField
                                label="Custom Application Title"
                                fullWidth
                                size="small"
                                placeholder="e.g. Acme Cloud Storage"
                                value={editCustomAppTitle}
                                onChange={(e) => setEditCustomAppTitle(e.target.value)}
                                sx={{ mb: 2 }}
                                helperText="Overrides default AbuGreySoft Box title for this workspace"
                            />
                            <Box sx={{ flex: 1 }}>
                                <TextField
                                    label="Custom Logo URL (Image Link)"
                                    fullWidth
                                    size="small"
                                    placeholder="https://example.com/logo.png"
                                    value={editCustomLogoUrl}
                                    onChange={(e) => setEditCustomLogoUrl(e.target.value)}
                                    helperText="URL to custom logo image or upload directly below"
                                />
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
                                    <Button
                                        component="label"
                                        variant="outlined"
                                        size="small"
                                        startIcon={uploadingEditLogo ? <CircularProgress size={16} /> : <CloudUploadIcon />}
                                        disabled={uploadingEditLogo}
                                        sx={{ borderRadius: 2, textTransform: 'none', borderColor: '#D3D1CB', color: '#37352F', bgcolor: 'white', '&:hover': { bgcolor: '#F1F1EF' } }}
                                    >
                                        {uploadingEditLogo ? 'Uploading...' : 'Upload Logo Image'}
                                        <input type="file" accept="image/*" hidden onChange={handleUploadEditLogo} />
                                    </Button>
                                    {editCustomLogoUrl && (
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Avatar src={editCustomLogoUrl} alt="Logo preview" sx={{ width: 28, height: 28, border: '1px solid #EAEAEA', bgcolor: 'transparent' }} />
                                            <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 600 }}>
                                                Logo ready
                                            </Typography>
                                        </Box>
                                    )}
                                </Box>
                            </Box>
                        </Box>

                        {isInheritedOrg && (
                            <Alert severity="info" sx={{ mb: 2 }}>
                                <strong>{selectedOrg?.name}</strong> was created by its owner rather than from a
                                licence key, so its quotas follow the licensed organization on the{' '}
                                <strong>{selectedOrg?.plan_name}</strong> plan. Edit that organization, or the{' '}
                                <strong>{selectedOrg?.plan_name}</strong> tier, to change these.
                                {' '}The owner may hold <strong>{selectedOrg?.owner_max_organizations}</strong>{' '}
                                organizations in total — a shared cap, not one per workspace.
                            </Alert>
                        )}

                        <Grid container spacing={1.5} sx={{ mb: 3 }}>
                            <Grid item xs={12} sm={4}>
                                <TextField
                                    label="Total Storage (GB)"
                                    type="number"
                                    fullWidth
                                    size="small"
                                    disabled={isInheritedOrg}
                                    value={editStorageGB}
                                    onChange={(e) => setEditStorageGB(e.target.value)}
                                />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <TextField
                                    label="Max Member Limit"
                                    type="number"
                                    fullWidth
                                    size="small"
                                    disabled={isInheritedOrg}
                                    value={editMaxMembers}
                                    onChange={(e) => setEditMaxMembers(e.target.value)}
                                />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <TextField
                                    label="Max Organizations"
                                    type="number"
                                    fullWidth
                                    size="small"
                                    disabled={isInheritedOrg}
                                    helperText={isInheritedOrg ? 'Inherited — shared across this owner' : 'Orgs this owner may create'}
                                    value={editMaxOrgs}
                                    onChange={(e) => setEditMaxOrgs(e.target.value)}
                                />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <TextField
                                    label="Per-Member Cap (GB)"
                                    type="number"
                                    fullWidth
                                    size="small"
                                    disabled={isInheritedOrg}
                                    value={editMemberStorageGB}
                                    onChange={(e) => setEditMemberStorageGB(e.target.value)}
                                />
                            </Grid>
                        </Grid>

                        <Box sx={{ mb: 3, p: 2, bgcolor: 'action.hover', borderRadius: 2, border: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <FormControlLabel
                                control={<Switch checked={editChat} onChange={(e) => setEditChat(e.target.checked)} color="primary" />}
                                label={<Typography variant="body2" fontWeight={600}>Enable Team Chat Feature</Typography>}
                            />
                            <FormControlLabel
                                control={<Switch checked={editApproval} onChange={(e) => setEditApproval(e.target.checked)} color="primary" />}
                                label={<Typography variant="body2" fontWeight={600}>Enable Approval Workflows Feature</Typography>}
                            />
                            {/* Switching this off also kills API keys already issued
                                for this organization, not just the sidebar item. */}
                            <FormControlLabel
                                control={<Switch checked={editIntegration} onChange={(e) => setEditIntegration(e.target.checked)} color="primary" />}
                                label={<Typography variant="body2" fontWeight={600}>Enable Integration Feature (API keys)</Typography>}
                            />
                            {/* Controls only whether the sidebar entry appears; the
                                CRM application enforces access on its own side. */}
                            <FormControlLabel
                                control={<Switch checked={editCrm} onChange={(e) => setEditCrm(e.target.checked)} color="primary" />}
                                label={<Typography variant="body2" fontWeight={600}>Enable AbuGreySoft CRM</Typography>}
                            />
                            {editCrm && (
                                <Stack direction="row" spacing={1.5} sx={{ pl: 5, pb: 1 }}>
                                    <TextField label="Max CRM Tables" type="number" size="small" fullWidth
                                        value={editCrmBoards} onChange={(e) => setEditCrmBoards(e.target.value)}
                                        helperText="0 = none" />
                                    <TextField label="Max CRM Records" type="number" size="small" fullWidth
                                        value={editCrmRecords} onChange={(e) => setEditCrmRecords(e.target.value)}
                                        helperText="Rows across all tables" />
                                </Stack>
                            )}
                        </Box>

                        <TextField
                            label="Admin Billing Notes (Internal)"
                            fullWidth
                            multiline
                            rows={3}
                            size="small"
                            placeholder="Add notes about invoice status, custom contract terms, etc."
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                        />
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 2.5, pt: 0 }}>
                    <Button onClick={() => setEditOrgModal(false)} color="inherit">Cancel</Button>
                    <Button onClick={handleSaveOrgBilling} variant="contained">Save Changes</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
