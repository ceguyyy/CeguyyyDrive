import React from 'react';
import { 
    ReactFlow, 
    Controls, 
    Background, 
    Handle,
    Position
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { 
    Box, Typography, Paper, Avatar, Chip, Stack 
} from '@mui/material';
import { 
    CheckCircle as CheckIcon, 
    HourglassEmpty as PendingIcon, 
    Cancel as CancelIcon,
    Send as SendIcon
} from '@mui/icons-material';

// Custom Flow Node Component
function FlowStepNode({ data }) {
    const isSubmitted = data.nodeType === 'submitter';
    const isApproved = data.status === 'approved';
    const isRejected = data.status === 'rejected';
    const isPending = data.status === 'pending';

    const getStatusColor = () => {
        if (isSubmitted) return '#3B82F6';
        if (isApproved) return '#10B981';
        if (isRejected) return '#EF4444';
        return '#F59E0B';
    };

    const borderColor = getStatusColor();

    return (
        <Paper 
            elevation={4} 
            sx={{ 
                p: 2, 
                minWidth: 220, 
                borderRadius: 3, 
                borderLeft: `6px solid ${borderColor}`,
                bgcolor: 'background.paper',
                border: '1px solid #E2E8F0'
            }}
        >
            <Handle type="target" position={Position.Left} />

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                <Avatar src={data.avatarUrl} sx={{ width: 36, height: 36, bgcolor: borderColor }}>
                    {data.name?.charAt(0)?.toUpperCase() || 'U'}
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle2" fontWeight="bold" noWrap>
                        {data.name || 'Unassigned Approver'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap display="block">
                        {data.roleName || 'Role'}
                    </Typography>
                </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
                {isSubmitted && (
                    <Chip 
                        icon={<SendIcon fontSize="small" />} 
                        label="Submitted" 
                        size="small" 
                        color="primary" 
                        variant="outlined" 
                    />
                )}
                {isApproved && (
                    <Chip 
                        icon={<CheckIcon fontSize="small" />} 
                        label="Approved ✓" 
                        size="small" 
                        color="success" 
                    />
                )}
                {isRejected && (
                    <Chip 
                        icon={<CancelIcon fontSize="small" />} 
                        label="Rejected ❌" 
                        size="small" 
                        color="error" 
                    />
                )}
                {isPending && (
                    <Chip 
                        icon={<PendingIcon fontSize="small" />} 
                        label="Pending ⏳" 
                        size="small" 
                        color="warning" 
                        variant="outlined" 
                    />
                )}
            </Box>

            {data.timestamp && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', fontSize: '0.7rem' }}>
                    🕒 {new Date(data.timestamp).toLocaleString()}
                </Typography>
            )}

            {data.comment && (
                <Typography variant="caption" color="text.primary" sx={{ mt: 0.5, display: 'block', fontStyle: 'italic', bgcolor: '#F8FAFC', p: 0.5, borderRadius: 1 }}>
                    "{data.comment}"
                </Typography>
            )}

            <Handle type="source" position={Position.Right} />
        </Paper>
    );
}

const nodeTypes = { flowStepNode: FlowStepNode };

export default function ApprovalFlowVisualizer({ approvalData }) {
    if (!approvalData || !approvalData.request) return null;

    const { request, steps } = approvalData;

    // Submitter Node
    const nodes = [
        {
            id: 'node-submitter',
            type: 'flowStepNode',
            position: { x: 50, y: 100 },
            data: {
                nodeType: 'submitter',
                name: request.requester_name,
                roleName: 'Requester',
                avatarUrl: request.requester_avatar,
                status: 'submitted',
                timestamp: request.created_at
            }
        }
    ];

    const edges = [];

    let prevNodeId = 'node-submitter';

    steps.forEach((st, idx) => {
        const nodeId = `node-step-${st.id || idx}`;
        nodes.push({
            id: nodeId,
            type: 'flowStepNode',
            position: { x: 320 + idx * 270, y: 100 },
            data: {
                nodeType: 'approver',
                name: st.approver_name || `Approver (${st.role_name})`,
                roleName: `Step ${st.step_number}: ${st.role_name}`,
                avatarUrl: st.approver_avatar,
                status: st.status,
                comment: st.comment,
                timestamp: st.action_timestamp
            }
        });

        const edgeColor = st.status === 'approved' ? '#10B981' : st.status === 'rejected' ? '#EF4444' : '#3B82F6';

        edges.push({
            id: `edge-${prevNodeId}-${nodeId}`,
            source: prevNodeId,
            target: nodeId,
            animated: st.status === 'pending',
            style: { stroke: edgeColor, strokeWidth: 3 }
        });

        prevNodeId = nodeId;
    });

    return (
        <Box sx={{ height: '350px', width: '100%', bgcolor: '#F8FAFC', borderRadius: 3, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                fitView
            >
                <Background color="#CBD5E1" gap={16} />
                <Controls />
            </ReactFlow>
        </Box>
    );
}
