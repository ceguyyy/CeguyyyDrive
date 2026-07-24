import React, { useState, useCallback, useEffect } from 'react';
import { 
    ReactFlow, 
    Controls, 
    Background, 
    applyNodeChanges, 
    applyEdgeChanges, 
    addEdge,
    Handle,
    Position
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { 
    Box, Button, Typography, Paper, TextField, IconButton, Chip, Stack, Alert 
} from '@mui/material';
import { 
    Add as AddIcon, 
    Save as SaveIcon, 
    Delete as DeleteIcon,
    AccountTree as TreeIcon
} from '@mui/icons-material';
import api from '../../services/api';

// Custom Role Node Component
function RoleNode({ id, data, isConnectable }) {
    return (
        <Paper 
            elevation={3} 
            sx={{ 
                p: 2, 
                minWidth: 180, 
                borderRadius: 3, 
                borderLeft: `6px solid ${data.color || '#3B82F6'}`,
                bgcolor: 'background.paper',
                border: '1px solid #E0E0E0'
            }}
        >
            <Handle type="target" position={Position.Top} isConnectable={isConnectable} />
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="subtitle2" fontWeight="bold" noWrap>
                    {data.name}
                </Typography>
                <IconButton size="small" onClick={() => data.onDelete(id)} color="error">
                    <DeleteIcon fontSize="small" />
                </IconButton>
            </Box>
            <Chip 
                label={data.roleType || 'Role Node'} 
                size="small" 
                sx={{ bgcolor: `${data.color}22`, color: data.color, fontWeight: 'bold' }} 
            />
            <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} />
        </Paper>
    );
}

const nodeTypes = { roleNode: RoleNode };

export default function RoleHierarchyCanvas({ orgId }) {
    const [nodes, setNodes] = useState([]);
    const [edges, setEdges] = useState([]);
    const [newRoleName, setNewRoleName] = useState('');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    const loadRoles = useCallback(async () => {
        if (!orgId) return;
        try {
            const res = await api.get(`/organizations/${orgId}/roles`);
            const roles = res.data.data.roles;

            const initialNodes = roles.map((r) => ({
                id: r.id,
                type: 'roleNode',
                position: { x: r.canvas_position_x || 250, y: r.canvas_position_y || 100 },
                data: { 
                    name: r.name, 
                    color: r.color || '#3B82F6',
                    onDelete: (nodeId) => handleDeleteNode(nodeId)
                }
            }));

            const initialEdges = roles
                .filter(r => r.parent_role_id)
                .map(r => ({
                    id: `e-${r.parent_role_id}-${r.id}`,
                    source: r.parent_role_id,
                    target: r.id,
                    animated: true,
                    style: { stroke: '#3B82F6', strokeWidth: 2 }
                }));

            setNodes(initialNodes);
            setEdges(initialEdges);
        } catch (err) {
            console.error('Failed to load roles', err);
        }
    }, [orgId]);

    useEffect(() => {
        loadRoles();
    }, [loadRoles]);

    const handleDeleteNode = (nodeId) => {
        setNodes((nds) => nds.filter((n) => n.id !== nodeId));
        setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    };

    const onNodesChange = useCallback(
        (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
        []
    );

    const onEdgesChange = useCallback(
        (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
        []
    );

    const onConnect = useCallback(
        (params) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#3B82F6', strokeWidth: 2 } }, eds)),
        []
    );

    const handleAddRole = () => {
        if (!newRoleName.trim()) return;
        const id = `node-${Date.now()}`;
        const newNode = {
            id,
            type: 'roleNode',
            position: { x: 250 + Math.random() * 50, y: 150 + Math.random() * 50 },
            data: { 
                name: newRoleName.trim(), 
                color: '#8B5CF6',
                onDelete: (nodeId) => handleDeleteNode(nodeId)
            }
        };
        setNodes((nds) => [...nds, newNode]);
        setNewRoleName('');
    };

    const handleSaveLayout = async () => {
        setSaving(true);
        setMessage('');
        try {
            const formattedRoles = nodes.map(n => {
                const parentEdge = edges.find(e => e.target === n.id);
                return {
                    id: n.id.startsWith('node-') ? null : n.id,
                    name: n.data.name,
                    parent_role_id: parentEdge ? (parentEdge.source.startsWith('node-') ? null : parentEdge.source) : null,
                    canvas_position_x: n.position.x,
                    canvas_position_y: n.position.y,
                    color: n.data.color
                };
            });

            await api.post(`/organizations/${orgId}/roles`, { roles: formattedRoles });
            setMessage('Role Hierarchy saved successfully!');
            setTimeout(() => setMessage(''), 3000);
            loadRoles();
        } catch (err) {
            setMessage('Failed to save role hierarchy');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Box sx={{ height: '600px', display: 'flex', flexDirection: 'column', bgcolor: '#F8FAFC', borderRadius: 3, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
            <Box sx={{ p: 2, bgcolor: 'background.paper', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TreeIcon color="primary" />
                    <Typography variant="h6" fontWeight="bold">
                        No-Code Role Hierarchy Canvas
                    </Typography>
                </Box>

                <Stack direction="row" spacing={1} alignItems="center">
                    <TextField 
                        size="small" 
                        placeholder="New Role Name" 
                        value={newRoleName}
                        onChange={(e) => setNewRoleName(e.target.value)}
                        sx={{ width: 180 }}
                    />
                    <Button 
                        variant="outlined" 
                        startIcon={<AddIcon />} 
                        onClick={handleAddRole}
                        disabled={!newRoleName.trim()}
                    >
                        Add Node
                    </Button>
                    <Button 
                        variant="contained" 
                        startIcon={<SaveIcon />} 
                        onClick={handleSaveLayout}
                        disabled={saving}
                    >
                        {saving ? 'Saving...' : 'Save Hierarchy'}
                    </Button>
                </Stack>
            </Box>

            {message && <Alert severity={message.includes('successfully') ? 'success' : 'error'} sx={{ m: 1 }}>{message}</Alert>}

            <Box sx={{ flexGrow: 1, width: '100%' }}>
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    nodeTypes={nodeTypes}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    fitView
                >
                    <Background color="#CBD5E1" gap={16} />
                    <Controls />
                </ReactFlow>
            </Box>
        </Box>
    );
}
