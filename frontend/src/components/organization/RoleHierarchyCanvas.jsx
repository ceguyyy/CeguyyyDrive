import React, { useState, useCallback, useEffect } from 'react';
import {
    ReactFlow,
    Controls,
    Background,
    applyNodeChanges,
    applyEdgeChanges,
    addEdge,
    Handle,
    Position,
    ReactFlowProvider,
    MiniMap,
    MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
    Box, Button, Typography, Paper, TextField, IconButton, Chip, Stack, Alert, Tooltip
} from '@mui/material';
import {
    Add as AddIcon,
    Save as SaveIcon,
    Delete as DeleteIcon,
    AccountTree as TreeIcon,
    CheckCircle as ConnectedIcon,
} from '@mui/icons-material';
import api from '../../services/api';
import { useAuthStore } from '../../store/authStore';

// ─── Custom Role Node ─────────────────────────────────────────────────────────
function RoleNode({ id, data, isConnectable }) {
    const isOwnerNode = data.isOwnerNode;
    const canEdit = data.canEdit;
    const superiorName = data.superiorName || null;
    const subordinateNames = data.subordinateNames || [];

    return (
        <Paper
            elevation={4}
            sx={{
                minWidth: { xs: 170, sm: 200 },
                maxWidth: { xs: 210, sm: 245 },
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: isOwnerNode
                    ? '0 4px 24px rgba(239,68,68,0.30)'
                    : '0 2px 10px rgba(0,0,0,0.12)',
                border: `2px solid ${data.color || '#3B82F6'}`,
                bgcolor: 'background.paper',
            }}
        >
            {/* Target handle (top) */}
            <Handle
                id="top"
                type="target"
                position={Position.Top}
                isConnectable={isConnectable && !isOwnerNode}
                style={{
                    background: superiorName ? '#10B981' : '#94A3B8',
                    width: 12,
                    height: 12,
                    border: '2px solid #fff',
                    top: -6,
                }}
            />

            {/* Color header bar */}
            <Box sx={{ height: 6, bgcolor: data.color || '#3B82F6' }} />

            {/* Card body */}
            <Box sx={{ p: '10px 12px' }}>
                {/* Title row */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="subtitle2" fontWeight={700} noWrap sx={{ color: '#1E293B', fontSize: '0.85rem' }}>
                        {isOwnerNode && '👑 '}{data.name}
                    </Typography>
                    {canEdit && !isOwnerNode && (
                        <Tooltip title="Delete role">
                            <IconButton
                                size="small"
                                onClick={() => data.onDelete(id)}
                                className="nodrag nopan"
                                sx={{ p: 0.3, color: '#EF4444', '&:hover': { bgcolor: '#FEE2E2' } }}
                            >
                                <DeleteIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                        </Tooltip>
                    )}
                </Box>

                {/* Superior */}
                {superiorName ? (
                    <Box sx={{ mb: 0.5 }}>
                        <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600, fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Superior
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.2 }}>
                            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#10B981', flexShrink: 0 }} />
                            <Typography variant="caption" sx={{ color: '#10B981', fontWeight: 700, fontSize: '0.72rem' }} noWrap>
                                {superiorName}
                            </Typography>
                        </Box>
                    </Box>
                ) : !isOwnerNode && (
                    <Box sx={{ mb: 0.5 }}>
                        <Typography variant="caption" sx={{ color: '#94A3B8', fontSize: '0.65rem', fontStyle: 'italic' }}>
                            No superior — drag ● from parent
                        </Typography>
                    </Box>
                )}

                {/* Subordinates */}
                {subordinateNames.length > 0 ? (
                    <Box>
                        <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600, fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Subordinate{subordinateNames.length > 1 ? 's' : ''}
                        </Typography>
                        <Stack spacing={0.2} mt={0.2}>
                            {subordinateNames.map((name, i) => (
                                <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#3B82F6', flexShrink: 0 }} />
                                    <Typography variant="caption" sx={{ color: '#3B82F6', fontWeight: 700, fontSize: '0.72rem' }} noWrap>
                                        {name}
                                    </Typography>
                                </Box>
                            ))}
                        </Stack>
                    </Box>
                ) : (
                    <Box>
                        <Typography variant="caption" sx={{ color: '#94A3B8', fontSize: '0.65rem', fontStyle: 'italic' }}>
                            No subordinates — drag ● to child
                        </Typography>
                    </Box>
                )}
            </Box>

            {/* Source handle (bottom) */}
            <Handle
                id="bottom"
                type="source"
                position={Position.Bottom}
                isConnectable={isConnectable && canEdit}
                style={{
                    background: subordinateNames.length > 0 ? '#3B82F6' : data.color || '#3B82F6',
                    width: 14,
                    height: 14,
                    border: '2px solid #fff',
                    bottom: -7,
                    boxShadow: '0 0 0 3px rgba(59,130,246,0.3)',
                }}
            />
        </Paper>
    );
}

const nodeTypes = { roleNode: RoleNode };

// ─── Main Canvas ──────────────────────────────────────────────────────────────
function HierarchyCanvasInner({ orgId, isOwner, currentUserRoleName }) {
    const [nodes, setNodes] = useState([]);
    const [edges, setEdges] = useState([]);
    const [newRoleName, setNewRoleName] = useState('');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    // Compute depth of each role ID from parent->child edges
    const computeDepths = (roles, edgesArr) => {
        const parentMap = {}; // childId -> parentId
        edgesArr.forEach(e => {
            parentMap[String(e.target)] = String(e.source);
        });
        const depths = {};
        const getDepth = (id) => {
            if (depths[id] !== undefined) return depths[id];
            const parentId = parentMap[id];
            if (!parentId) { depths[id] = 0; return 0; }
            depths[id] = getDepth(parentId) + 1;
            return depths[id];
        };
        roles.forEach(r => getDepth(String(r.id)));
        return depths;
    };

    const buildNodes = useCallback((roles, edgesArr) => {
        const roleNameMap = {};  // id -> name
        roles.forEach(r => { roleNameMap[String(r.id)] = r.name; });

        const parentMap = {};    // childId -> parentId
        const childrenMap = {};  // parentId -> [childId, ...]
        edgesArr.forEach(e => {
            parentMap[String(e.target)] = String(e.source);
            if (!childrenMap[String(e.source)]) childrenMap[String(e.source)] = [];
            childrenMap[String(e.source)].push(String(e.target));
        });

        const depths = computeDepths(roles, edgesArr);

        // Find the current user's depth by matching role name
        let userDepth = -1; // -1 = unknown, treat as owner
        if (!isOwner && currentUserRoleName) {
            const matchRole = roles.find(r =>
                r.name.toLowerCase() === currentUserRoleName.toLowerCase()
            );
            if (matchRole) userDepth = depths[String(matchRole.id)] ?? 0;
        }

        return roles.map(r => {
            const rid = String(r.id);
            const parentId = parentMap[rid];
            const isOwnerNode = !r.parent_role_id && !parentId;
            const superiorName = parentId ? (roleNameMap[parentId] || parentId) : null;
            const subordinateNames = (childrenMap[rid] || []).map(cid => roleNameMap[cid] || cid);
            const nodeDepth = depths[rid] ?? 0;

            // canEdit: owner can edit all; non-owner can ONLY edit nodes strictly below their depth
            const canEdit = isOwner ? true : (userDepth >= 0 && nodeDepth > userDepth);

            return {
                id: rid,
                type: 'roleNode',
                position: { x: r.canvas_position_x ?? 300, y: r.canvas_position_y ?? 100 },
                data: {
                    name: r.name,
                    color: isOwnerNode ? '#EF4444' : (r.color || '#3B82F6'),
                    isOwnerNode,
                    superiorName,
                    subordinateNames,
                    nodeDepth,
                    canEdit,
                    onDelete: (id) => handleDeleteNode(id),
                }
            };
        });
    }, [isOwner, currentUserRoleName]);

    const loadRoles = useCallback(async () => {
        if (!orgId) return;
        try {
            const res = await api.get(`/organizations/${orgId}/roles`);
            const roles = res.data.data.roles;

            const initialEdges = roles
                .filter(r => r.parent_role_id)
                .map(r => ({
                    id: `e-${String(r.parent_role_id)}-${String(r.id)}`,
                    source: String(r.parent_role_id),
                    target: String(r.id),
                    sourceHandle: 'bottom',
                    targetHandle: 'top',
                    type: 'smoothstep',
                    animated: true,
                    style: { stroke: '#3B82F6', strokeWidth: 2.5 },
                    markerEnd: { type: MarkerType.ArrowClosed, color: '#3B82F6' },
                }));

            setEdges(initialEdges);
            setNodes(buildNodes(roles, initialEdges));
        } catch (err) {
            console.error('Failed to load roles', err);
        }
    }, [orgId, buildNodes]);

    useEffect(() => { loadRoles(); }, [loadRoles]);

    const handleDeleteNode = useCallback((nodeId) => {
        const id = String(nodeId);
        setNodes(nds => nds.filter(n => String(n.id) !== id));
        setEdges(eds => eds.filter(e => String(e.source) !== id && String(e.target) !== id));
    }, []);

    const onNodesChange = useCallback((changes) => setNodes(nds => applyNodeChanges(changes, nds)), []);
    const onEdgesChange = useCallback((changes) => setEdges(eds => applyEdgeChanges(changes, eds)), []);

    // Called when edges are deleted via Delete key
    const onEdgesDelete = useCallback((deletedEdges) => {
        setNodes(nds => {
            let updated = [...nds];
            deletedEdges.forEach(e => {
                const srcId = String(e.source);
                const tgtId = String(e.target);
                const tgtName = nds.find(n => String(n.id) === tgtId)?.data.name || tgtId;
                const srcName = nds.find(n => String(n.id) === srcId)?.data.name || srcId;
                updated = updated.map(n => {
                    const nid = String(n.id);
                    if (nid === srcId) {
                        return {
                            ...n,
                            data: {
                                ...n.data,
                                subordinateNames: (n.data.subordinateNames || []).filter(s => s !== tgtName),
                            }
                        };
                    }
                    if (nid === tgtId) {
                        return {
                            ...n,
                            data: { ...n.data, superiorName: null }
                        };
                    }
                    return n;
                });
            });
            return updated;
        });
    }, []);

    const onConnect = useCallback((params) => {
        const srcId = String(params.source);
        const tgtId = String(params.target);

        // A node cannot be its own superior
        if (srcId === tgtId) return;

        const newEdge = {
            id: `e-${srcId}-${tgtId}`,
            source: srcId,
            target: tgtId,
            sourceHandle: 'bottom',
            targetHandle: 'top',
            type: 'smoothstep',
            animated: true,
            style: { stroke: '#3B82F6', strokeWidth: 2.5 },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#3B82F6' },
        };

        setEdges(eds => {
            const parentOf = {};
            eds.forEach(e => { parentOf[String(e.target)] = String(e.source); });
            let cursor = parentOf[srcId];
            while (cursor) {
                if (cursor === tgtId) return eds;
                cursor = parentOf[cursor];
            }

            const oldParentIds = eds
                .filter(e => String(e.target) === tgtId)
                .map(e => String(e.source));
            const withoutOldParent = eds.filter(e => String(e.target) !== tgtId);
            return addEdge(newEdge, withoutOldParent);
        });

        setNodes(nds => {
            const srcName = nds.find(n => String(n.id) === srcId)?.data.name || srcId;
            const tgtName = nds.find(n => String(n.id) === tgtId)?.data.name || tgtId;
            return nds.map(n => {
                const nid = String(n.id);
                if (nid === srcId) {
                    const base = (n.data.subordinateNames || []).filter(s => s !== tgtName);
                    return {
                        ...n,
                        data: { ...n.data, subordinateNames: [...base, tgtName] },
                    };
                }
                if (nid === tgtId) {
                    return {
                        ...n,
                        data: { ...n.data, superiorName: srcName },
                    };
                }
                return n;
            });
        });
    }, []);

    const handleAddRole = () => {
        if (!newRoleName.trim()) return;
        const id = `node-${Date.now()}`;

        const myNode = !isOwner && currentUserRoleName
            ? nodes.find(n => n.data.name.toLowerCase() === currentUserRoleName.toLowerCase())
            : null;

        const newNode = {
            id,
            type: 'roleNode',
            position: {
                x: myNode ? myNode.position.x + (Math.random() * 120 - 60) : 80 + Math.random() * 300,
                y: myNode ? myNode.position.y + 180 : 350 + Math.random() * 80,
            },
            data: {
                name: newRoleName.trim(),
                color: '#8B5CF6',
                isOwnerNode: false,
                superiorName: myNode ? myNode.data.name : null,
                subordinateNames: [],
                nodeDepth: myNode ? (myNode.data.nodeDepth ?? 0) + 1 : 999,
                canEdit: true,
                onDelete: (nid) => handleDeleteNode(nid),
            }
        };

        setNodes(nds => {
            const updated = myNode
                ? nds.map(n =>
                    String(n.id) === String(myNode.id)
                        ? {
                            ...n,
                            data: {
                                ...n.data,
                                subordinateNames: Array.from(
                                    new Set([...(n.data.subordinateNames || []), newRoleName.trim()])
                                ),
                            }
                        }
                        : n
                )
                : nds;
            if (updated.find(n => n.id === id)) return updated;
            return [...updated, newNode];
        });

        if (myNode) {
            const autoEdge = {
                id: `e-${String(myNode.id)}-${id}`,
                source: String(myNode.id),
                target: id,
                sourceHandle: 'bottom',
                targetHandle: 'top',
                type: 'smoothstep',
                animated: true,
                style: { stroke: '#8B5CF6', strokeWidth: 2.5 },
                markerEnd: { type: MarkerType.ArrowClosed, color: '#8B5CF6' },
            };
            setEdges(eds => addEdge(autoEdge, eds));
        }

        setNewRoleName('');
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage('');
        try {
            const formattedRoles = nodes.map(n => {
                const nid = String(n.id);
                const parentEdge = edges.find(e => String(e.target) === nid);
                let parentId = null;
                if (parentEdge) {
                    const src = String(parentEdge.source);
                    parentId = src.startsWith('node-') ? null : src;
                }
                return {
                    id: nid.startsWith('node-') ? null : nid,
                    name: n.data.name,
                    parent_role_id: parentId,
                    canvas_position_x: Math.round(n.position.x),
                    canvas_position_y: Math.round(n.position.y),
                    color: n.data.color,
                    storage_limit: null,
                };
            });
            await api.post(`/organizations/${orgId}/roles`, { roles: formattedRoles });
            setMessage('Hierarchy saved!');
            setTimeout(() => setMessage(''), 3000);
            loadRoles();
        } catch {
            setMessage('Failed to save.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {/* Toolbar */}
            <Box sx={{
                p: { xs: '10px', sm: '8px 14px' },
                bgcolor: 'background.paper',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TreeIcon color="primary" fontSize="small" />
                    <Typography variant="subtitle1" fontWeight={700}>Role Hierarchy</Typography>
                </Box>
                {/* Add Role + Save */}
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center" sx={{ width: { xs: '100%', sm: 'auto' } }}>
                    <TextField
                        size="small" placeholder="New role name…"
                        value={newRoleName}
                        onChange={e => setNewRoleName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddRole()}
                        sx={{ width: { xs: '100%', sm: 160 }, '& .MuiInputBase-input': { fontSize: '0.8rem' } }}
                    />
                    <Stack direction="row" spacing={1} sx={{ width: { xs: '100%', sm: 'auto' }, justifyContent: 'flex-end' }}>
                        <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={handleAddRole} disabled={!newRoleName.trim()} fullWidth={{ xs: true, sm: false }}>
                            Add Role
                        </Button>
                        <Button variant="contained" size="small" startIcon={<SaveIcon />} onClick={handleSave} disabled={saving} fullWidth={{ xs: true, sm: false }}>
                            {saving ? 'Saving…' : 'Save'}
                        </Button>
                    </Stack>
                </Stack>
            </Box>

            {/* Tip bar */}
            <Box sx={{ px: 2, py: 0.5, bgcolor: '#EFF6FF', borderBottom: '1px solid #DBEAFE', display: 'flex', gap: { xs: 1, sm: 3 }, flexWrap: 'wrap' }}>
                <Typography variant="caption" color="primary.main">📌 Drag card to move</Typography>
                <Typography variant="caption" color="primary.main">🔗 Drag <strong>blue dot (bottom)</strong> → card to connect</Typography>
                <Typography variant="caption" color="error.main">🗑 Click a line then press <strong>Delete</strong> to remove</Typography>
                {!isOwner && (
                    <Typography variant="caption" sx={{ color: '#D97706' }}>⚠️ You can only add/connect roles below your level</Typography>
                )}
            </Box>

            {message && (
                <Alert severity={message.includes('saved') ? 'success' : 'error'} sx={{ mx: 1, mt: 0.5, py: 0 }}>
                    {message}
                </Alert>
            )}

            {/* Canvas */}
            <Box sx={{ flexGrow: 1, minHeight: 0, height: '100%', position: 'relative', width: '100%' }}>
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    nodeTypes={nodeTypes}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onEdgesDelete={onEdgesDelete}
                    fitView
                    fitViewOptions={{ padding: 0.35 }}
                    connectionLineStyle={{ stroke: '#3B82F6', strokeWidth: 2.5, strokeDasharray: '5 5' }}
                    connectionLineType="smoothstep"
                    snapToGrid
                    snapGrid={[15, 15]}
                    deleteKeyCode="Delete"
                    style={{ width: '100%', height: '100%', background: '#F8FAFC' }}
                    defaultEdgeOptions={{
                        type: 'smoothstep',
                        animated: true,
                        style: { stroke: '#3B82F6', strokeWidth: 2.5 },
                        markerEnd: { type: MarkerType.ArrowClosed, color: '#3B82F6' },
                    }}
                >
                    <Background color="#CBD5E1" gap={20} />
                    <Controls />
                    <MiniMap nodeStrokeWidth={3} zoomable pannable style={{ height: 80 }} />
                </ReactFlow>
            </Box>
        </Box>
    );
}

// ─── Wrapper with ReactFlowProvider ──────────────────────────────────────────
export default function RoleHierarchyCanvas({ orgId, orgOwnerId, members = [], currentUserMembership }) {
    const user = useAuthStore(state => state.user);
    const isOwner = orgOwnerId === user?.id;
    const currentUserRoleName = currentUserMembership?.role_name || null;

    return (
        <Box sx={{ height: { xs: '540px', sm: '640px', md: '700px' }, width: '100%', display: 'flex', flexDirection: 'column', borderRadius: 3, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
            {/* Permission Info Banner */}
            {!isOwner && currentUserRoleName && (
                <Box sx={{
                    px: 2, py: 0.75,
                    bgcolor: '#FFF7ED',
                    borderBottom: '1px solid #FED7AA',
                    display: 'flex', alignItems: 'center', gap: 1
                }}>
                    <Typography variant="caption" sx={{ color: '#C2410C', fontWeight: 600 }}>
                        🔒 You are logged in as <strong>{currentUserRoleName}</strong> — you can only manage roles that are strictly below your level.
                    </Typography>
                </Box>
            )}
            <ReactFlowProvider>
                <HierarchyCanvasInner
                    orgId={orgId}
                    isOwner={isOwner}
                    currentUserRoleName={currentUserRoleName}
                />
            </ReactFlowProvider>
        </Box>
    );
}
