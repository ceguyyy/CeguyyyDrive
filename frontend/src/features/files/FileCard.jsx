import React, { useState } from 'react';
import { InsertDriveFile as DocumentIcon, Image as ImageIcon, CheckCircle as ApprovedIcon, HourglassEmpty as PendingIcon, Cancel as RejectedIcon, Star as StarFilledIcon, StarBorder as StarOutlineIcon } from '@mui/icons-material';
import { Card, CardActionArea, CardContent, Typography, Box, Checkbox, Skeleton, Chip, IconButton, Tooltip } from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { getDownloadUrlPath } from '../../utils/downloadUrl';
import ContextMenu from '../../components/ui/ContextMenu';
import RenameModal from '../../components/modals/RenameModal';
import FilePreviewModal from '../../components/modals/FilePreviewModal';
import CopyToDriveModal from '../../components/modals/CopyToDriveModal';
import ShareModal from '../../components/modals/ShareModal';
import SubmitForApprovalModal from '../../components/modals/SubmitForApprovalModal';
import ApprovalMetadataModal from '../../components/approvals/ApprovalMetadataModal';
import { useItemActions } from '../../hooks/useItemActions';

const APPROVAL_BADGE = {
    pending: { label: 'Pending', color: 'warning', icon: PendingIcon },
    approved: { label: 'Approved', color: 'success', icon: ApprovedIcon },
    rejected: { label: 'Rejected', color: 'error', icon: RejectedIcon },
};

function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function FileCard({ 
    file, selected = false, onSelect = () => {}, selectionMode = false, 
    onCopyItem, onCutItem, customRenameFile, customDeleteFile,
    viewMode = 'grid'
}) {
    const [isRenameOpen, setIsRenameOpen] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isShareOpen, setIsShareOpen] = useState(false);
    const [isApprovalOpen, setIsApprovalOpen] = useState(false);
    const [isApprovalMetaOpen, setIsApprovalMetaOpen] = useState(false);
    const [isCopyToDriveOpen, setIsCopyToDriveOpen] = useState(false);

    // A file in a Company Drive can only be copied out to My Drive, and a
    // personal file only copied in.
    const copyToDriveLabel = file.organization_id ? 'Copy to My Drive' : 'Copy to Company Drive';
    const { renameFile: defaultRename, deleteFile: defaultDelete } = useItemActions(file.folder_id);
    const renameFile = customRenameFile || defaultRename;
    const deleteFile = customDeleteFile || defaultDelete;
    const queryClient = useQueryClient();

    const displayName = file.original_name || file.name;
    const isImage = file.mime_type?.startsWith('image/');
    const approvalBadge = file.approval_status ? APPROVAL_BADGE[file.approval_status] : null;

    const starMutation = useMutation({
        mutationFn: async () => {
            const res = await api.patch(`/files/${file.id}/star`);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['files'] });
            queryClient.invalidateQueries({ queryKey: ['starred-files'] });
        }
    });

    const { data: thumbnailUrl, isLoading: isThumbnailLoading } = useQuery({
        queryKey: ['thumbnail', file.id],
        queryFn: async () => {
            const res = await api.get(getDownloadUrlPath(file));
            return res.data.data.downloadUrl;
        },
        enabled: isImage,
        staleTime: 1000 * 60 * 15
    });

    const handleCardClick = (e) => {
        if (selectionMode) {
            e.preventDefault();
            onSelect();
        } else {
            setIsPreviewOpen(true);
        }
    };

    if (viewMode === 'list') {
        return (
            <>
                <Card 
                    draggable
                    onDragStart={(e) => {
                        e.dataTransfer.setData('application/json', JSON.stringify({ type: 'file', id: file.id }));
                        e.dataTransfer.effectAllowed = 'move';
                    }}
                    elevation={0}
                    onClick={handleCardClick}
                    sx={{
                        width: '100%',
                        height: 52,
                        display: 'flex',
                        alignItems: 'center',
                        px: 2,
                        gap: 2,
                        borderRadius: 2,
                        border: selected ? '2px solid #1976d2' : '1px solid #E5E7EB',
                        bgcolor: selected ? '#EFF6FF' : '#FFFFFF',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease-in-out',
                        '&:hover': { bgcolor: '#F9FAFB', border: '1px solid #D1D5DB' }
                    }}
                >
                    <Checkbox 
                        checked={selected}
                        onChange={(e) => { e.stopPropagation(); onSelect(); }}
                        onClick={(e) => e.stopPropagation()}
                        size="small"
                    />
                    
                    {isImage && thumbnailUrl ? (
                        <Box component="img" src={thumbnailUrl} alt={displayName} sx={{ width: 28, height: 28, borderRadius: 1, objectFit: 'cover' }} />
                    ) : (
                        <DocumentIcon sx={{ color: '#2563EB', fontSize: 24 }} />
                    )}

                    <Typography variant="body2" fontWeight="500" sx={{ flex: 1, minWidth: 0, color: 'text.primary' }} noWrap title={displayName}>
                        {displayName}
                    </Typography>

                    {approvalBadge && (
                        <Chip
                            icon={<approvalBadge.icon sx={{ fontSize: '0.8rem' }} />}
                            label={approvalBadge.label}
                            size="small"
                            color={approvalBadge.color}
                            onClick={(e) => { e.stopPropagation(); setIsApprovalMetaOpen(true); }}
                            sx={{ height: 22, fontSize: '0.65rem' }}
                        />
                    )}

                    <IconButton
                        size="small"
                        onClick={(e) => {
                            e.stopPropagation();
                            starMutation.mutate();
                        }}
                        sx={{ color: file.is_starred ? '#D97706' : '#D1D5DB' }}
                    >
                        {file.is_starred ? <StarFilledIcon sx={{ fontSize: 18 }} /> : <StarOutlineIcon sx={{ fontSize: 18 }} />}
                    </IconButton>

                    {file.created_at && (
                        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 140, display: { xs: 'none', sm: 'block' } }}>
                            {new Date(file.created_at).toLocaleDateString()}
                        </Typography>
                    )}

                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 80, display: { xs: 'none', md: 'block' } }}>
                        {formatBytes(file.size)}
                    </Typography>

                    <Box onClick={(e) => e.stopPropagation()}>
                        <ContextMenu
                            isStarred={file.is_starred}
                            onStar={() => starMutation.mutate()}
                            onRename={() => setIsRenameOpen(true)}
                            onDelete={() => deleteFile.mutate(file.id)}
                            onShare={() => setIsShareOpen(true)}
                            onApproval={() => setIsApprovalOpen(true)}
                            onViewApprovalStatus={approvalBadge ? () => setIsApprovalMetaOpen(true) : null}
                            onCopy={() => onCopyItem?.('file', file.id)}
                            onCut={() => onCutItem?.('file', file.id)}
                            onCopyToDrive={() => setIsCopyToDriveOpen(true)}
                            copyToDriveLabel={copyToDriveLabel}
                        />
                    </Box>
                </Card>

                <RenameModal
                    isOpen={isRenameOpen}
                    currentName={displayName}
                    onClose={() => setIsRenameOpen(false)}
                    onSave={(newName) => renameFile.mutate({ id: file.id, newName })}
                />

                <CopyToDriveModal
                    isOpen={isCopyToDriveOpen}
                    onClose={() => setIsCopyToDriveOpen(false)}
                    file={file}
                />

                <FilePreviewModal
                    isOpen={isPreviewOpen}
                    onClose={() => setIsPreviewOpen(false)}
                    file={file}
                />

                <ShareModal
                    isOpen={isShareOpen}
                    onClose={() => setIsShareOpen(false)}
                    itemType="file"
                    itemId={file.id}
                    itemName={displayName}
                />

                <SubmitForApprovalModal
                    isOpen={isApprovalOpen}
                    onClose={() => setIsApprovalOpen(false)}
                    isFile={true}
                    item={file}
                />

                {file.approval_request_id && (
                    <ApprovalMetadataModal
                        isOpen={isApprovalMetaOpen}
                        onClose={() => setIsApprovalMetaOpen(false)}
                        requestId={file.approval_request_id}
                    />
                )}
            </>
        );
    }

    return (
        <>
            <Card 
                draggable
                onDragStart={(e) => {
                    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'file', id: file.id }));
                    e.dataTransfer.effectAllowed = 'move';
                }}
                elevation={0} 
                sx={{ 
                    aspectRatio: '1 / 1', overflow: 'hidden', height: '100%', 
                    display: 'flex', flexDirection: 'column', position: 'relative',
                    border: selected ? '2px solid #1976d2' : '1px solid #E5E7EB',
                    '&:hover .selection-checkbox': { opacity: 1 },
                    '&:hover .star-button': { opacity: 1 },
                    cursor: 'grab',
                    '&:active': { cursor: 'grabbing' }
                }}
            >
                <Checkbox 
                    className="selection-checkbox"
                    checked={selected}
                    onChange={(e) => { e.stopPropagation(); onSelect(); }}
                    onClick={(e) => e.stopPropagation()}
                    sx={{ 
                        position: 'absolute', top: 4, left: 4, zIndex: 5,
                        opacity: selected || selectionMode ? 1 : 0, transition: 'opacity 0.2s'
                    }}
                />
                
                <Tooltip title={file.is_starred ? "Remove from Starred" : "Add to Starred"} placement="top">
                    <span>
                        <IconButton
                            className="star-button"
                            size="small"
                            onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                starMutation.mutate();
                            }}
                            sx={{
                                position: 'absolute', top: 8, right: 8, zIndex: 10,
                                opacity: file.is_starred ? 1 : 0,
                                transition: 'all 0.2s ease-in-out',
                                color: file.is_starred ? '#D97706' : '#9CA3AF',
                                bgcolor: file.is_starred ? 'rgba(254, 243, 199, 0.95)' : 'rgba(255, 255, 255, 0.9)',
                                border: file.is_starred ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(0,0,0,0.08)',
                                boxShadow: file.is_starred ? '0 2px 8px rgba(245, 158, 11, 0.25)' : '0 2px 6px rgba(0,0,0,0.08)',
                                backdropFilter: 'blur(4px)',
                                '&:hover': {
                                    bgcolor: file.is_starred ? '#FEF3C7' : '#FFFFFF',
                                    color: '#F59E0B',
                                    transform: 'scale(1.12)'
                                },
                                '&:active': { transform: 'scale(0.95)' },
                                p: '4px'
                            }}
                        >
                            {file.is_starred ? <StarFilledIcon sx={{ fontSize: 18 }} /> : <StarOutlineIcon sx={{ fontSize: 18 }} />}
                        </IconButton>
                    </span>
                </Tooltip>

                <CardActionArea component="div" onClick={handleCardClick} sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ 
                        bgcolor: '#F7F7F5', 
                        flex: 1, 
                        width: '100%',
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        borderBottom: '1px solid #EAEAEA',
                        position: 'relative'
                    }}>
                        {isImage ? (
                            isThumbnailLoading ? (
                                <Skeleton variant="rectangular" width="100%" height="100%" />
                            ) : thumbnailUrl ? (
                                <Box
                                    component="img"
                                    src={thumbnailUrl}
                                    alt={displayName}
                                    sx={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover'
                                    }}
                                />
                            ) : (
                                <ImageIcon sx={{ fontSize: 64, color: 'text.secondary' }} />
                            )
                        ) : (
                            <DocumentIcon sx={{ fontSize: 64, color: 'text.secondary' }} />
                        )}

                        {approvalBadge && (
                            <Chip
                                icon={<approvalBadge.icon sx={{ fontSize: '0.9rem' }} />}
                                label={approvalBadge.label}
                                size="small"
                                color={approvalBadge.color}
                                onClick={(e) => { e.stopPropagation(); setIsApprovalMetaOpen(true); }}
                                sx={{ position: 'absolute', top: 8, right: 44, zIndex: 4, height: 22, fontSize: '0.65rem', '& .MuiChip-icon': { ml: 0.5 } }}
                            />
                        )}
                    </Box>
                </CardActionArea>
                <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="body2" fontWeight="500" noWrap title={displayName}>
                            {displayName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap display="block">
                            {formatBytes(file.size)} {file.created_at ? `• ${new Date(file.created_at).toLocaleDateString()}` : ''}
                        </Typography>
                    </Box>
                    <ContextMenu
                        isStarred={file.is_starred}
                        onStar={() => starMutation.mutate()}
                        onRename={() => setIsRenameOpen(true)}
                        onDelete={() => deleteFile.mutate(file.id)}
                        onShare={() => setIsShareOpen(true)}
                        onApproval={() => setIsApprovalOpen(true)}
                        onViewApprovalStatus={approvalBadge ? () => setIsApprovalMetaOpen(true) : null}
                        onCopy={() => onCopyItem?.('file', file.id)}
                        onCut={() => onCutItem?.('file', file.id)}
                        onCopyToDrive={() => setIsCopyToDriveOpen(true)}
                        copyToDriveLabel={copyToDriveLabel}
                    />
                </CardContent>
            </Card>

            <RenameModal
                isOpen={isRenameOpen}
                currentName={displayName}
                onClose={() => setIsRenameOpen(false)}
                onSave={(newName) => renameFile.mutate({ id: file.id, newName })}
            />

            <CopyToDriveModal
                isOpen={isCopyToDriveOpen}
                onClose={() => setIsCopyToDriveOpen(false)}
                file={file}
            />

            <FilePreviewModal
                isOpen={isPreviewOpen}
                onClose={() => setIsPreviewOpen(false)}
                file={file}
            />

            <ShareModal
                isOpen={isShareOpen}
                onClose={() => setIsShareOpen(false)}
                itemType="file"
                itemId={file.id}
                itemName={displayName}
            />

            <SubmitForApprovalModal
                isOpen={isApprovalOpen}
                onClose={() => setIsApprovalOpen(false)}
                isFile={true}
                item={file}
            />

            {file.approval_request_id && (
                <ApprovalMetadataModal
                    isOpen={isApprovalMetaOpen}
                    onClose={() => setIsApprovalMetaOpen(false)}
                    requestId={file.approval_request_id}
                />
            )}
        </>
    );
}
