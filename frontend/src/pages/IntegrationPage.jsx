import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Box, Typography, Button, Card, CardContent, Table, TableBody, TableCell,
    TableHead, TableRow, Chip, IconButton, Dialog, DialogTitle, DialogContent,
    DialogActions, TextField, Stack, Alert, Tooltip, Divider, FormControlLabel,
    Checkbox, CircularProgress, TablePagination, MenuItem
} from '@mui/material';
import {
    Add as AddIcon,
    Delete as RevokeIcon,
    ContentCopy as CopyIcon,
    Key as KeyIcon,
    Download as DownloadIcon
} from '@mui/icons-material';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { usePagination } from '../hooks/usePagination';
import { isSuperAdmin } from '../utils/roles';
import {
    SCOPES, ENDPOINT_GROUPS, curlFor, buildPostmanCollection
} from '../utils/integrationEndpoints';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8080/v1').replace(/\/$/, '');
const INTEGRATION_BASE = `${API_BASE.endsWith('/v1') ? API_BASE : `${API_BASE}/v1`}/integration/v1`;

const formatDate = (value) => (value ? new Date(value).toLocaleString() : '—');

// Reading files is the least a key can usefully do, so it is the default and
// cannot be unchecked to nothing.
const DEFAULT_SCOPES = ['files:read', 'files:write'];

// Sentinel for "my own drive" in the target selector. Not a uuid, so it cannot
// collide with an organization id.
const PERSONAL_TARGET = '__personal__';

// A personal key has no organization to read or invite into, so the server
// rejects the organization scopes outright.
const PERSONAL_SCOPES = ['files:read', 'files:write'];

function CodeBlock({ children }) {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        navigator.clipboard.writeText(children);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };
    return (
        <Box sx={{ position: 'relative', my: 1.5 }}>
            <Box
                component="pre"
                sx={{
                    m: 0, p: 2, pr: 6, borderRadius: 2, bgcolor: '#1e1e1e', color: '#e6e6e6',
                    fontSize: '0.78rem', lineHeight: 1.6, overflowX: 'auto',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace'
                }}
            >
                {children}
            </Box>
            <Tooltip title={copied ? 'Copied' : 'Copy'}>
                <IconButton
                    size="small"
                    onClick={copy}
                    sx={{ position: 'absolute', top: 8, right: 8, color: '#9e9e9e' }}
                >
                    <CopyIcon fontSize="small" />
                </IconButton>
            </Tooltip>
        </Box>
    );
}

function Endpoint({ endpoint, baseUrl }) {
    const colour = endpoint.method === 'GET' ? 'info' : 'success';
    return (
        <Box sx={{ mb: 4 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5, flexWrap: 'wrap', gap: 0.5 }}>
                <Chip size="small" label={endpoint.method} color={colour} sx={{ fontWeight: 700, minWidth: 56 }} />
                <Typography component="code" sx={{ fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 600 }}>
                    {endpoint.path}
                </Typography>
                {endpoint.scope && (
                    <Chip size="small" variant="outlined" label={endpoint.scope} sx={{ fontFamily: 'monospace', fontSize: '0.68rem' }} />
                )}
            </Stack>
            <Typography variant="body2" color="text.secondary">{endpoint.description}</Typography>

            <Typography variant="caption" fontWeight={700} sx={{ display: 'block', mt: 1.5, color: 'text.secondary' }}>
                REQUEST
            </Typography>
            <CodeBlock>{curlFor(endpoint, baseUrl)}</CodeBlock>

            {endpoint.followUp && (
                <>
                    <Typography variant="caption" fontWeight={700} sx={{ display: 'block', color: 'text.secondary' }}>
                        THEN
                    </Typography>
                    <CodeBlock>{endpoint.followUp}</CodeBlock>
                </>
            )}

            {endpoint.response && (
                <>
                    <Typography variant="caption" fontWeight={700} sx={{ display: 'block', color: 'text.secondary' }}>
                        RESPONSE
                    </Typography>
                    <CodeBlock>{JSON.stringify(endpoint.response, null, 2)}</CodeBlock>
                </>
            )}
        </Box>
    );
}

/**
 * Owner-facing API key management and integration documentation.
 *
 * Keys are shown once at creation and stored only as a hash, so this page can
 * never redisplay one — it shows the prefix to identify a key and nothing more.
 */
export default function IntegrationPage() {
    const queryClient = useQueryClient();
    const { user, activeOrgId } = useAuthStore();

    const [createOpen, setCreateOpen] = useState(false);
    const [name, setName] = useState('');
    const [selectedScopes, setSelectedScopes] = useState(DEFAULT_SCOPES);
    const [expiresInDays, setExpiresInDays] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [issuedKey, setIssuedKey] = useState(null);
    const [keyToRevoke, setKeyToRevoke] = useState(null);
    const [copiedIssued, setCopiedIssued] = useState(false);

    const superAdmin = isSuperAdmin(user);

    const { data: orgsData } = useQuery({
        queryKey: ['organizations'],
        queryFn: async () => {
            const res = await api.get('/organizations');
            return res.data.data;
        }
    });

    // Only organizations this user actually belongs to — a Super Admin included.
    // Operating the platform is not the same as being entitled to a customer's
    // drive, and apiKeyService.assertCanManageKeys enforces the same boundary.
    const selectableOrgs = orgsData?.organizations ?? [];

    // Local to this page on purpose: switching the target here must not move the
    // whole app's drive context the way the Profile Settings switcher does.
    const [selectedTarget, setSelectedTarget] = useState(null);
    const isPersonalTarget = selectedTarget === PERSONAL_TARGET;
    const activeOrg = isPersonalTarget
        ? null
        : (selectableOrgs.find(o => o.id === (selectedTarget || activeOrgId)) || selectableOrgs[0]);

    // A personal key needs no owner check and no billing feature: it reaches
    // nothing but the caller's own drive.
    // For organizations this mirrors apiKeyService.assertCanManageKeys — owner
    // only, with no Super Admin exception.
    const canManage = isPersonalTarget || activeOrg?.owner_id === user?.id;
    const featureEnabled = isPersonalTarget || activeOrg?.feature_integration_enabled === true;

    const targetLabel = isPersonalTarget ? 'My Personal Drive' : activeOrg?.name;
    const keysPath = isPersonalTarget ? '/users/me/api-keys' : `/organizations/${activeOrg?.id}/api-keys`;
    const availableScopes = isPersonalTarget
        ? SCOPES.filter(s => PERSONAL_SCOPES.includes(s.value))
        : SCOPES;

    const { data: keysData, isLoading } = useQuery({
        queryKey: ['api-keys', isPersonalTarget ? 'personal' : activeOrg?.id],
        queryFn: async () => {
            const res = await api.get(keysPath);
            return res.data.data.keys;
        },
        // Not gated on featureEnabled: a Super Admin manages keys for an
        // organization before switching the feature on.
        enabled: (isPersonalTarget || !!activeOrg?.id) && canManage
    });
    const keys = keysData || [];
    const pagination = usePagination(keys, 10);

    const submitCreate = async () => {
        setSaving(true);
        setError('');
        try {
            const res = await api.post(keysPath, {
                name, scopes: selectedScopes, expiresInDays: expiresInDays || undefined
            });
            setIssuedKey(res.data.data.plaintext);
            setCreateOpen(false);
            setName('');
            setExpiresInDays('');
            queryClient.invalidateQueries({ queryKey: ['api-keys', isPersonalTarget ? 'personal' : activeOrg?.id] });
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create the API key.');
        } finally {
            setSaving(false);
        }
    };

    // Built in the browser and released immediately; the file deliberately
    // contains an empty `apiKey` variable, never a real key.
    const downloadPostmanCollection = () => {
        const collection = buildPostmanCollection(INTEGRATION_BASE, targetLabel);
        const blob = new Blob([JSON.stringify(collection, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `abugreysoft-box-integration-${targetLabel.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.postman_collection.json`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const submitRevoke = async () => {
        setSaving(true);
        try {
            await api.delete(`${keysPath}/${keyToRevoke.id}`);
            setKeyToRevoke(null);
            queryClient.invalidateQueries({ queryKey: ['api-keys', isPersonalTarget ? 'personal' : activeOrg?.id] });
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to revoke the key.');
        } finally {
            setSaving(false);
        }
    };

    if (!activeOrg && !isPersonalTarget) {
        return (
            <Box sx={{ p: 4 }}>
                <Alert severity="info">Select an organization to manage its integrations.</Alert>
            </Box>
        );
    }

    if (!canManage) {
        return (
            <Box sx={{ p: 4 }}>
                <Alert severity="warning">
                    Only the owner of <strong>{targetLabel}</strong>, or a platform administrator,
                    can manage API keys.
                </Alert>
            </Box>
        );
    }

    // A Super Admin still reaches the page for their OWN organizations with the
    // feature off — they are the one who turns it on — but keys they mint stay
    // rejected until they do, so the state is stated plainly rather than hidden.
    if (!featureEnabled && !superAdmin) {
        return (
            <Box sx={{ p: 4 }}>
                <Alert severity="info">
                    The Integration feature is not enabled for <strong>{targetLabel}</strong>.
                    Ask your platform administrator to switch it on in the Billing Console.
                </Alert>
            </Box>
        );
    }

    return (
        <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1100, mx: 'auto' }}>
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 3 }}>
                <KeyIcon color="primary" />
                <Box>
                    <Typography variant="h5" fontWeight={800}>Integration</Typography>
                    <Typography variant="body2" color="text.secondary">
                        {isPersonalTarget ? <>Connect <strong>your Personal Drive</strong> to other systems.</> : <>Connect <strong>{targetLabel}</strong>&apos;s Company Drive to other systems.</>}
                    </Typography>
                </Box>
            </Stack>

            <TextField
                select
                size="small"
                label="Integration target"
                value={isPersonalTarget ? PERSONAL_TARGET : activeOrg?.id || ''}
                onChange={(e) => setSelectedTarget(e.target.value)}
                sx={{ mb: 3, minWidth: 300 }}
                helperText={
                    isPersonalTarget
                        ? 'Personal keys reach only your own drive — no organization endpoints.'
                        : 'Only organizations you own can hold API keys.'
                }
            >
                    <MenuItem value={PERSONAL_TARGET}>My Personal Drive</MenuItem>
                    {selectableOrgs.map(o => (
                        <MenuItem key={o.id} value={o.id}>
                            {o.name}{o.feature_integration_enabled ? '' : ' — Integration off'}
                        </MenuItem>
                    ))}
            </TextField>

            {isPersonalTarget && (
                <Alert severity="info" sx={{ mb: 2 }}>
                    A Personal Drive key reaches only your own files. The organization, member, and approval
                    endpoints below need an organization key and will return 403 with this one.
                </Alert>
            )}

            {!featureEnabled && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                    Integration is switched off for <strong>{targetLabel}</strong>. You can manage keys here,
                    but every API request using them is rejected until you enable the feature in the Billing Console.
                </Alert>
            )}

            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

            {/* ── API keys ─────────────────────────────────────────────── */}
            <Card variant="outlined" sx={{ borderRadius: 3, mb: 4 }}>
                <CardContent>
                    <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        justifyContent="space-between"
                        alignItems={{ xs: 'stretch', sm: 'flex-start' }}
                        spacing={2}
                        sx={{ mb: 3, width: '100%' }}
                    >
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="h6" fontWeight="bold">API Keys ({keys.length})</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 620 }}>
                                A key is shown once, when it is created, and stored only as a hash — it cannot be
                                displayed again. Lose it and you issue a new one.
                            </Typography>
                        </Box>
                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={() => { setError(''); setCreateOpen(true); }}
                            sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
                        >
                            New API Key
                        </Button>
                    </Stack>

                    {isLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
                    ) : (
                        <>
                            <Box sx={{ overflowX: 'auto' }}>
                                <Table sx={{ minWidth: 760 }}>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Name</TableCell>
                                            <TableCell>Key</TableCell>
                                            <TableCell>Scopes</TableCell>
                                            <TableCell>Last Used</TableCell>
                                            <TableCell>Expires</TableCell>
                                            <TableCell>Status</TableCell>
                                            <TableCell>Actions</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {keys.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                                                    No API keys yet.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                        {pagination.paginated.map((k) => (
                                            <TableRow key={k.id}>
                                                <TableCell>
                                                    <Typography variant="body2" fontWeight={600}>{k.name}</Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Typography component="code" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                                        {k.key_prefix}…
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                                                        {(k.scopes || []).map(s => (
                                                            <Chip key={s} size="small" label={s} variant="outlined" />
                                                        ))}
                                                    </Stack>
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '0.8rem' }}>{formatDate(k.last_used_at)}</TableCell>
                                                <TableCell sx={{ fontSize: '0.8rem' }}>{formatDate(k.expires_at)}</TableCell>
                                                <TableCell>
                                                    <Chip
                                                        size="small"
                                                        label={k.revoked_at ? 'REVOKED' : 'ACTIVE'}
                                                        color={k.revoked_at ? 'default' : 'success'}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    {!k.revoked_at && (
                                                        <Tooltip title="Revoke this key">
                                                            <IconButton size="small" color="error" onClick={() => setKeyToRevoke(k)}>
                                                                <RevokeIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    )}
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
                                rowsPerPageOptions={[5, 10, 25]}
                            />
                        </>
                    )}
                </CardContent>
            </Card>

            {/* ── Documentation ────────────────────────────────────────── */}
            <Card variant="outlined" sx={{ borderRadius: 3 }}>
                <CardContent>
                    <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        justifyContent="space-between"
                        alignItems={{ xs: 'stretch', sm: 'center' }}
                        spacing={2}
                        sx={{ mb: 1, width: '100%' }}
                    >
                        <Typography variant="h6" fontWeight="bold" sx={{ flex: 1 }}>API Documentation</Typography>
                        <Button
                            variant="outlined"
                            startIcon={<DownloadIcon />}
                            onClick={downloadPostmanCollection}
                            sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
                        >
                            Download Postman Collection
                        </Button>
                    </Stack>

                    <Typography variant="subtitle2" fontWeight={700} sx={{ mt: 2 }}>Base URL</Typography>
                    <CodeBlock>{INTEGRATION_BASE}</CodeBlock>

                    <Typography variant="subtitle2" fontWeight={700} sx={{ mt: 2 }}>Authentication</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Send your key in the <code>X-API-Key</code> header on every request. The organization is
                        determined by the key, so no organization id is ever passed — a key cannot reach another
                        organization's drive.
                    </Typography>
                    <CodeBlock>{`X-API-Key: cgd_xxxxxxxxxxxx_xxxxxxxxxxxxxxxxxxxxxxxxxxxx`}</CodeBlock>

                    <Alert severity="info" sx={{ my: 2 }}>
                        Keys reach the Company Drive only: listing, downloading, uploading, and creating folders.
                        Members, roles, approvals, billing, deletion, and renaming are not available to a key,
                        so a leaked key cannot be used to take over the organization.
                    </Alert>

                    <Divider sx={{ my: 3 }} />

                    {ENDPOINT_GROUPS.map(group => (
                        <Box key={group.name} sx={{ mb: 2 }}>
                            <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 2 }}>
                                {group.name}
                            </Typography>
                            {group.endpoints.map(endpoint => (
                                <Endpoint
                                    key={`${endpoint.method} ${endpoint.path}`}
                                    endpoint={endpoint}
                                    baseUrl={INTEGRATION_BASE}
                                />
                            ))}
                            <Divider sx={{ my: 3 }} />
                        </Box>
                    ))}

                    <Typography variant="subtitle2" fontWeight={700}>Errors</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        Failures return a JSON body with a <code>message</code>. Codes you should handle:
                    </Typography>
                    <Box sx={{ overflowX: 'auto' }}>
                        <Table size="small" sx={{ minWidth: 460 }}>
                            <TableBody>
                                <TableRow><TableCell><strong>401</strong></TableCell><TableCell>Missing, unknown, revoked, or expired key.</TableCell></TableRow>
                                <TableRow><TableCell><strong>403</strong></TableCell><TableCell>Key lacks the required scope, or Integration is switched off for this organization.</TableCell></TableRow>
                                <TableRow><TableCell><strong>404</strong></TableCell><TableCell>Folder or file not found in this organization.</TableCell></TableRow>
                                <TableRow><TableCell><strong>429</strong></TableCell><TableCell>Rate limited. Back off and retry.</TableCell></TableRow>
                            </TableBody>
                        </Table>
                    </Box>
                </CardContent>
            </Card>

            {/* ── Create dialog ────────────────────────────────────────── */}
            <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ fontWeight: 'bold' }}>New API Key</DialogTitle>
                <DialogContent>
                    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField
                            label="Key Name" size="small" fullWidth required autoFocus
                            value={name} onChange={(e) => setName(e.target.value)}
                            helperText="How you will recognise this key later, e.g. “Accounting sync”."
                        />
                        <Box>
                            <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>Scopes</Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                                Grant only what the integration needs. A key that just reads files should not
                                be able to invite people or approve documents.
                            </Typography>
                            {availableScopes.map(scope => (
                                <Box key={scope.value} sx={{ mb: 0.5 }}>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                size="small"
                                                checked={selectedScopes.includes(scope.value)}
                                                onChange={(e) => setSelectedScopes(prev => (
                                                    e.target.checked
                                                        ? [...prev, scope.value]
                                                        : prev.filter(s => s !== scope.value)
                                                ))}
                                            />
                                        }
                                        label={
                                            <Box>
                                                <Typography variant="body2" fontWeight={600}>{scope.label}</Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    <code>{scope.value}</code> — {scope.hint}
                                                </Typography>
                                            </Box>
                                        }
                                        sx={{ alignItems: 'flex-start', m: 0 }}
                                    />
                                </Box>
                            ))}
                        </Box>
                        <TextField
                            label="Expires in (days)" size="small" type="number" fullWidth
                            value={expiresInDays} onChange={(e) => setExpiresInDays(e.target.value)}
                            helperText="Leave blank for a key that never expires."
                        />
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setCreateOpen(false)} disabled={saving}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={submitCreate}
                        disabled={saving || !name.trim() || selectedScopes.length === 0}
                    >
                        {saving ? 'Creating…' : 'Create Key'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* ── One-time reveal ──────────────────────────────────────── */}
            <Dialog open={!!issuedKey} onClose={() => setIssuedKey(null)} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ fontWeight: 'bold' }}>Copy your API key now</DialogTitle>
                <DialogContent>
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        This is the only time the key is shown. It is stored as a hash and cannot be recovered —
                        if you lose it, revoke it and create another.
                    </Alert>
                    <Box
                        component="pre"
                        sx={{
                            m: 0, p: 2, borderRadius: 2, bgcolor: '#1e1e1e', color: '#7ee787',
                            fontSize: '0.8rem', overflowX: 'auto', fontFamily: 'monospace'
                        }}
                    >
                        {issuedKey}
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button
                        startIcon={<CopyIcon />}
                        onClick={() => {
                            navigator.clipboard.writeText(issuedKey);
                            setCopiedIssued(true);
                            setTimeout(() => setCopiedIssued(false), 1500);
                        }}
                    >
                        {copiedIssued ? 'Copied' : 'Copy Key'}
                    </Button>
                    <Button variant="contained" onClick={() => setIssuedKey(null)}>Done</Button>
                </DialogActions>
            </Dialog>

            {/* ── Revoke ───────────────────────────────────────────────── */}
            <Dialog open={!!keyToRevoke} onClose={() => setKeyToRevoke(null)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ fontWeight: 'bold' }}>Revoke “{keyToRevoke?.name}”?</DialogTitle>
                <DialogContent>
                    <Typography variant="body2">
                        Any integration using this key stops working immediately. This cannot be undone.
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setKeyToRevoke(null)} disabled={saving}>Cancel</Button>
                    <Button variant="contained" color="error" onClick={submitRevoke} disabled={saving}>
                        {saving ? 'Revoking…' : 'Revoke Key'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
