import { useState } from 'react';
import {
    Box, Typography, Button, Card, CardContent, Table, TableBody, TableCell,
    TableHead, TableRow, Chip, IconButton, Dialog, DialogTitle, DialogContent,
    DialogActions, TextField, Switch, FormControlLabel, Stack, Alert, Tooltip,
    TablePagination
} from '@mui/material';
import {
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Chat as ChatIcon,
    AssignmentTurnedIn as ApprovalIcon,
    Hub as HubIcon
} from '@mui/icons-material';
import api from '../../services/api';
import { usePagination } from '../../hooks/usePagination';

const BYTES_PER_GB = 1024 ** 3;
const toGB = (bytes) => (Number(bytes || 0) / BYTES_PER_GB);

const EMPTY_FORM = {
    name: '',
    label: '',
    storage_limit_gb: 100,
    member_storage_limit_gb: 20,
    max_members: 25,
    max_organizations: 3,
    feature_approval_enabled: true,
    feature_chat_enabled: true,
    // Off by default: Integration exposes an API surface, so a new tier opts in.
    feature_integration_enabled: false,
    sort_order: 100
};

const formFromTier = (tier) => ({
    name: tier.name,
    label: tier.label || '',
    storage_limit_gb: toGB(tier.storage_limit_bytes),
    member_storage_limit_gb: toGB(tier.member_storage_limit_bytes),
    max_members: tier.max_members,
    max_organizations: tier.max_organizations,
    feature_approval_enabled: tier.feature_approval_enabled,
    feature_chat_enabled: tier.feature_chat_enabled,
    feature_integration_enabled: tier.feature_integration_enabled,
    sort_order: tier.sort_order
});

/**
 * CRUD for the subscription_tiers table.
 *
 * A tier is a preset: organizations copy its numbers when they are provisioned
 * and own them afterwards. Editing one therefore changes nothing retroactively
 * unless the admin opts in, and deleting one leaves existing organizations
 * running on the quotas they already hold.
 */
export default function SubscriptionTierManager({ tiers = [], onChanged }) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingTier, setEditingTier] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [tierToDelete, setTierToDelete] = useState(null);
    const [applyPrompt, setApplyPrompt] = useState(null);
    const pagination = usePagination(tiers, 10);

    const setField = (key) => (event) => {
        const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const openCreate = () => {
        setEditingTier(null);
        setForm(EMPTY_FORM);
        setError('');
        setDialogOpen(true);
    };

    const openEdit = (tier) => {
        setEditingTier(tier);
        setForm(formFromTier(tier));
        setError('');
        setDialogOpen(true);
    };

    const persist = async (applyToExisting) => {
        setSaving(true);
        setError('');
        try {
            if (editingTier) {
                const res = await api.put(`/billing/tiers/${editingTier.id}`, {
                    ...form,
                    apply_to_existing: applyToExisting
                });
                const applied = res.data.data.applied;
                setNotice(
                    applied
                        ? `Tier "${form.name}" saved and applied to ${applied.organizations} organization(s) and ${applied.licenses} unredeemed license(s).`
                        : `Tier "${form.name}" saved. Existing organizations were left unchanged.`
                );
            } else {
                await api.post('/billing/tiers', form);
                setNotice(`Tier "${form.name}" created.`);
            }
            setDialogOpen(false);
            setApplyPrompt(null);
            setEditingTier(null);
            onChanged?.();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save tier.');
            setApplyPrompt(null);
        } finally {
            setSaving(false);
        }
    };

    const handleSave = () => {
        // Editing a tier that nobody uses has nothing to propagate, so skip
        // straight past the prompt.
        const inUse = editingTier && Number(editingTier.organization_count || 0) > 0;
        if (inUse) {
            setApplyPrompt(editingTier);
            return;
        }
        persist(false);
    };

    const handleDelete = async () => {
        setSaving(true);
        try {
            await api.delete(`/billing/tiers/${tierToDelete.id}`);
            setNotice(`Tier "${tierToDelete.name}" deleted. Existing organizations keep their current quotas.`);
            setTierToDelete(null);
            onChanged?.();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to delete tier.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Box>
            {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice('')}>{notice}</Alert>}
            {error && !dialogOpen && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

            <Card variant="outlined" sx={{ borderRadius: 3 }}>
                <CardContent>
                    {/* alignItems flex-start + spacing keeps the button clear of the
                        description, and flexShrink:0 stops it collapsing into the
                        text once the copy wraps on a narrow viewport. */}
                    <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        justifyContent="space-between"
                        alignItems={{ xs: 'stretch', sm: 'flex-start' }}
                        spacing={2}
                        sx={{ mb: 3, width: '100%' }}
                    >
                        {/* flex:1 makes the text absorb the free space, which is
                            what actually pins the button to the right edge —
                            space-between alone leaves it beside the copy. */}
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="h6" fontWeight="bold">Subscription Tiers ({tiers.length})</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 560 }}>
                                Presets applied when provisioning. Existing organizations keep their own quotas
                                unless you choose to apply a change to them.
                            </Typography>
                        </Box>
                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={openCreate}
                            sx={{ flexShrink: 0, whiteSpace: 'nowrap', alignSelf: { sm: 'flex-start' } }}
                        >
                            New Tier
                        </Button>
                    </Stack>

                    {/* Eight columns overflow a narrow viewport; scroll the table
                        rather than the page. */}
                    <Box sx={{ overflowX: 'auto' }}>
                    <Table sx={{ minWidth: 880 }}>
                        <TableHead>
                            <TableRow>
                                <TableCell>Tier</TableCell>
                                <TableCell>Total Storage</TableCell>
                                <TableCell>Per-Member Cap</TableCell>
                                <TableCell>Max Members</TableCell>
                                <TableCell>Max Orgs</TableCell>
                                <TableCell>Features</TableCell>
                                <TableCell>In Use</TableCell>
                                <TableCell>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {tiers.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                                        No subscription tiers yet.
                                    </TableCell>
                                </TableRow>
                            )}
                            {pagination.paginated.map((tier) => (
                                <TableRow key={tier.id}>
                                    <TableCell>
                                        <Typography variant="body2" fontWeight={600}>{tier.label || tier.name}</Typography>
                                        <Typography variant="caption" color="text.secondary">{tier.name}</Typography>
                                    </TableCell>
                                    <TableCell>{toGB(tier.storage_limit_bytes).toLocaleString()} GB</TableCell>
                                    <TableCell>{toGB(tier.member_storage_limit_bytes).toLocaleString()} GB</TableCell>
                                    <TableCell>{tier.max_members}</TableCell>
                                    <TableCell>{tier.max_organizations}</TableCell>
                                    <TableCell>
                                        <Stack direction="row" spacing={0.5}>
                                            {tier.feature_chat_enabled && (
                                                <Chip size="small" icon={<ChatIcon />} label="Chat" variant="outlined" />
                                            )}
                                            {tier.feature_integration_enabled && (
                                                <Chip size="small" icon={<HubIcon />} label="API" variant="outlined" />
                                            )}
                                            {tier.feature_approval_enabled && (
                                                <Chip size="small" icon={<ApprovalIcon />} label="Appr" variant="outlined" />
                                            )}
                                        </Stack>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2">{tier.organization_count} org</Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {tier.available_license_count} key
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'nowrap' }}>
                                            <Tooltip title="Edit tier">
                                                <IconButton size="small" onClick={() => openEdit(tier)}>
                                                    <EditIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Delete tier">
                                                <IconButton size="small" color="error" onClick={() => setTierToDelete(tier)}>
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </Stack>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    </Box>
                    <TablePagination
                        component="div"
                        count={pagination.count}
                        page={pagination.page}
                        onPageChange={pagination.handlePageChange}
                        rowsPerPage={pagination.rowsPerPage}
                        onRowsPerPageChange={pagination.handleRowsPerPageChange}
                        rowsPerPageOptions={[5, 10, 25, 50]}
                    />
                </CardContent>
            </Card>

            {/* Create / Edit */}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ fontWeight: 'bold' }}>
                    {editingTier ? `Edit Tier — ${editingTier.name}` : 'New Subscription Tier'}
                </DialogTitle>
                <DialogContent>
                    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField
                            label="Tier Name" size="small" fullWidth required
                            value={form.name} onChange={setField('name')}
                            helperText="Stored on each organization as its plan. Renaming updates every organization using it."
                        />
                        <TextField
                            label="Display Label" size="small" fullWidth
                            value={form.label} onChange={setField('label')}
                            helperText="Shown in the dropdown, e.g. “Pro Business”. Defaults to the tier name."
                        />
                        <Stack direction="row" spacing={2}>
                            <TextField
                                label="Total Storage (GB)" size="small" type="number" fullWidth required
                                value={form.storage_limit_gb} onChange={setField('storage_limit_gb')}
                            />
                            <TextField
                                label="Per-Member Cap (GB)" size="small" type="number" fullWidth required
                                value={form.member_storage_limit_gb} onChange={setField('member_storage_limit_gb')}
                            />
                        </Stack>
                        <Stack direction="row" spacing={2}>
                            <TextField
                                label="Max Members" size="small" type="number" fullWidth required
                                value={form.max_members} onChange={setField('max_members')}
                            />
                            <TextField
                                label="Max Organizations" size="small" type="number" fullWidth required
                                value={form.max_organizations} onChange={setField('max_organizations')}
                            />
                        </Stack>
                        <TextField
                            label="Sort Order" size="small" type="number" fullWidth
                            value={form.sort_order} onChange={setField('sort_order')}
                            helperText="Lower numbers appear first in the tier dropdown."
                        />
                        <FormControlLabel
                            control={<Switch checked={!!form.feature_approval_enabled} onChange={setField('feature_approval_enabled')} />}
                            label="Enable Approval Workflows"
                        />
                        <FormControlLabel
                            control={<Switch checked={!!form.feature_chat_enabled} onChange={setField('feature_chat_enabled')} />}
                            label="Enable Chat"
                        />
                        <FormControlLabel
                            control={<Switch checked={!!form.feature_integration_enabled} onChange={setField('feature_integration_enabled')} />}
                            label="Enable Integration (API keys)"
                        />
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleSave} disabled={saving || !String(form.name).trim()}>
                        {saving ? 'Saving…' : (editingTier ? 'Save Tier' : 'Create Tier')}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Retroactive apply — only reached when the tier is actually in use */}
            <Dialog open={!!applyPrompt} onClose={() => setApplyPrompt(null)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ fontWeight: 'bold' }}>Apply to existing organizations?</DialogTitle>
                <DialogContent>
                    <Typography variant="body2">
                        <strong>{applyPrompt?.organization_count}</strong> organization(s) and{' '}
                        <strong>{applyPrompt?.available_license_count}</strong> unredeemed license key(s) are on
                        the <strong>{applyPrompt?.name}</strong> tier.
                    </Typography>
                    <Alert severity="warning" sx={{ mt: 2 }}>
                        Applying overwrites any per-organization quota you set by hand, and can put an organization
                        over its storage limit if you are lowering it.
                    </Alert>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setApplyPrompt(null)} disabled={saving}>Cancel</Button>
                    <Button onClick={() => persist(false)} disabled={saving}>
                        Save for new only
                    </Button>
                    <Button variant="contained" color="warning" onClick={() => persist(true)} disabled={saving}>
                        {saving ? 'Applying…' : 'Save & apply to all'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete */}
            <Dialog open={!!tierToDelete} onClose={() => setTierToDelete(null)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ fontWeight: 'bold' }}>Delete “{tierToDelete?.name}”?</DialogTitle>
                <DialogContent>
                    <Typography variant="body2">
                        The tier disappears from the provisioning dropdown. The{' '}
                        <strong>{tierToDelete?.organization_count}</strong> organization(s) on it keep the quotas
                        they already hold and are not disrupted.
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setTierToDelete(null)} disabled={saving}>Cancel</Button>
                    <Button variant="contained" color="error" onClick={handleDelete} disabled={saving}>
                        {saving ? 'Deleting…' : 'Delete Tier'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
