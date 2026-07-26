import { useState } from 'react';
import {
    Box, Typography, Button, Card, CardContent, Table, TableBody, TableCell,
    TableHead, TableRow, Chip, IconButton, Dialog, DialogTitle, DialogContent,
    DialogActions, TextField, Stack, Alert, Tooltip, Avatar, TablePagination
} from '@mui/material';
import {
    Block as SuspendIcon,
    PlayArrow as ActivateIcon,
    Search as SearchIcon
} from '@mui/icons-material';
import api from '../../services/api';
import { usePagination } from '../../hooks/usePagination';

const BYTES_PER_GB = 1024 ** 3;
const toGB = (bytes) => (Number(bytes || 0) / BYTES_PER_GB).toFixed(2);

/**
 * Platform-wide user administration.
 *
 * Suspending blocks sign-in AND invalidates tokens already issued, because
 * authMiddleware.protect re-checks status on every request.
 */
export default function ManagedUsersTab({ users = [], currentUserId, onChanged }) {
    const [search, setSearch] = useState('');
    const [target, setTarget] = useState(null);
    const [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    const filtered = users.filter((u) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (u.email || '').toLowerCase().includes(q)
            || (u.full_name || '').toLowerCase().includes(q);
    });

    // Paginate the filtered list, so the page reflects what the search shows.
    const pagination = usePagination(filtered, 10);

    const submitStatus = async (user, status) => {
        setSaving(true);
        setError('');
        try {
            await api.patch(`/billing/users/${user.id}/status`, { status, reason });
            setNotice(
                status === 'suspended'
                    ? `${user.email} suspended. They are signed out immediately and cannot sign back in.`
                    : `${user.email} reactivated.`
            );
            setTarget(null);
            setReason('');
            onChanged?.();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update user status.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Box>
            {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice('')}>{notice}</Alert>}
            {error && !target && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

            <Card variant="outlined" sx={{ borderRadius: 3 }}>
                <CardContent>
                    <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        justifyContent="space-between"
                        alignItems={{ xs: 'stretch', sm: 'flex-start' }}
                        spacing={2}
                        sx={{ mb: 3, width: '100%' }}
                    >
                        {/* flex:1 makes the text absorb the free space, which is
                            what actually pins the search box to the right edge —
                            space-between alone leaves it beside the copy. */}
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="h6" fontWeight="bold">Managed Users ({users.length})</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 560 }}>
                                Suspending a user blocks sign-in and revokes any session already open.
                                Their files and organization memberships are left untouched.
                            </Typography>
                        </Box>
                        <TextField
                            size="small"
                            placeholder="Search by name or email…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            InputProps={{ startAdornment: <SearchIcon sx={{ fontSize: 18, mr: 1, color: 'text.secondary' }} /> }}
                            sx={{ minWidth: 260, flexShrink: 0 }}
                        />
                    </Stack>

                    <Box sx={{ overflowX: 'auto' }}>
                        <Table sx={{ minWidth: 900 }}>
                            <TableHead>
                                <TableRow>
                                    <TableCell>User</TableCell>
                                    <TableCell>Platform Role</TableCell>
                                    <TableCell>Organizations</TableCell>
                                    <TableCell>Storage Used</TableCell>
                                    <TableCell>Status</TableCell>
                                    <TableCell>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filtered.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                                            {users.length === 0 ? 'No users registered yet.' : 'No users match that search.'}
                                        </TableCell>
                                    </TableRow>
                                )}
                                {pagination.paginated.map((u) => {
                                    const isSelf = String(u.id) === String(currentUserId);
                                    const isSuspended = u.status === 'suspended';
                                    return (
                                        <TableRow key={u.id}>
                                            <TableCell>
                                                <Stack direction="row" spacing={1.5} alignItems="center">
                                                    <Avatar sx={{ width: 32, height: 32 }}>
                                                        {(u.full_name || u.email || 'U').charAt(0).toUpperCase()}
                                                    </Avatar>
                                                    <Box sx={{ minWidth: 0 }}>
                                                        <Typography variant="body2" fontWeight={600}>
                                                            {u.full_name || '—'}{isSelf && ' (you)'}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {u.email}
                                                        </Typography>
                                                    </Box>
                                                </Stack>
                                            </TableCell>
                                            <TableCell>
                                                <Chip size="small" variant="outlined" label={u.role_name || 'user'} />
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2">{u.owned_org_count} owned</Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {u.membership_count} member of
                                                </Typography>
                                            </TableCell>
                                            <TableCell>{toGB(u.storage_used_bytes)} GB</TableCell>
                                            <TableCell>
                                                <Chip
                                                    size="small"
                                                    label={isSuspended ? 'SUSPENDED' : 'ACTIVE'}
                                                    color={isSuspended ? 'error' : 'success'}
                                                />
                                                {isSuspended && u.suspension_reason && (
                                                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                                                        {u.suspension_reason}
                                                    </Typography>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {isSuspended ? (
                                                    <Tooltip title="Reactivate account">
                                                        <IconButton
                                                            size="small"
                                                            color="success"
                                                            onClick={() => submitStatus(u, 'active')}
                                                            disabled={saving}
                                                        >
                                                            <ActivateIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                ) : (
                                                    <Tooltip title={isSelf ? 'You cannot suspend your own account' : 'Suspend sign-in'}>
                                                        {/* span: a disabled MUI button emits no hover events, so the
                                                            Tooltip would never render without a wrapper. */}
                                                        <span>
                                                            <IconButton
                                                                size="small"
                                                                color="error"
                                                                onClick={() => { setReason(''); setTarget(u); }}
                                                                disabled={isSelf || saving}
                                                            >
                                                                <SuspendIcon fontSize="small" />
                                                            </IconButton>
                                                        </span>
                                                    </Tooltip>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
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

            <Dialog open={!!target} onClose={() => setTarget(null)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ fontWeight: 'bold' }}>Suspend {target?.email}?</DialogTitle>
                <DialogContent>
                    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                    <Typography variant="body2" sx={{ mb: 2 }}>
                        They are signed out on their next request and cannot sign back in until reactivated.
                        Files and organization memberships are kept.
                    </Typography>
                    <TextField
                        label="Reason (optional)"
                        size="small"
                        fullWidth
                        multiline
                        rows={2}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        helperText="Shown to admins in this table, not to the user."
                    />
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setTarget(null)} disabled={saving}>Cancel</Button>
                    <Button
                        variant="contained"
                        color="error"
                        onClick={() => submitStatus(target, 'suspended')}
                        disabled={saving}
                    >
                        {saving ? 'Suspending…' : 'Suspend Account'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
