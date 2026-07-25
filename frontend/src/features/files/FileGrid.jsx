import React, { useMemo } from 'react';
import FolderCard from './FolderCard';
import FileCard from './FileCard';
import { Box, Typography } from '@mui/material';

const getFirstLetter = (name) => {
    if (!name) return '#';
    const char = name.trim().charAt(0).toUpperCase();
    return /[A-Z]/.test(char) ? char : '#';
};

export default function FileGrid({ 
    folders = [], files = [], sortBy = 'name', sortOrder = 'asc',
    selectedFolders = new Set(), selectedFiles = new Set(), 
    onToggleFolder = () => {}, onToggleFile = () => {}, 
    selectionMode = false,
    onCopyItem, onCutItem,
    viewMode = 'grid',
    children
}) {
    if (children) {
        return (
            <Box sx={viewMode === 'list' ? { display: 'flex', flexDirection: 'column', gap: 1, pb: 4 } : { 
                display: 'grid', 
                gridTemplateColumns: { 
                    xs: 'minmax(0, 1fr)', 
                    sm: 'repeat(2, minmax(0, 1fr))', 
                    md: 'repeat(3, minmax(0, 1fr))', 
                    lg: 'repeat(4, minmax(0, 1fr))', 
                    xl: 'repeat(5, minmax(0, 1fr))' 
                }, 
                gap: 3,
                pb: 4
            }}>
                {React.Children.map(children, child => {
                    if (React.isValidElement(child)) {
                        return React.cloneElement(child, { viewMode });
                    }
                    return child;
                })}
            </Box>
        );
    }

    if ((!folders || folders.length === 0) && (!files || files.length === 0)) {
        return (
            <Box sx={{ 
                flex: 1, 
                border: '2px dashed #D0D0D0',
                bgcolor: 'background.paper',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                borderRadius: 2,
                p: 4
            }}>
                <Typography variant="h6" color="text.secondary">
                    This folder is empty
                </Typography>
            </Box>
        );
    }

    const renderFolders = () => {
        if (sortBy !== 'name') {
            return folders.map(folder => (
                <Box key={folder.id}>
                    <FolderCard 
                        folder={folder} 
                        selected={selectedFolders.has(folder.id)}
                        onSelect={() => onToggleFolder(folder.id)}
                        selectionMode={selectionMode}
                        onCopyItem={onCopyItem}
                        onCutItem={onCutItem}
                        viewMode={viewMode}
                    />
                </Box>
            ));
        }

        const groups = {};
        folders.forEach(folder => {
            const letter = getFirstLetter(folder.name);
            if (!groups[letter]) groups[letter] = [];
            groups[letter].push(folder);
        });

        const sortedKeys = Object.keys(groups).sort();
        if (sortOrder === 'desc') sortedKeys.reverse();

        return sortedKeys.map(letter => (
            <React.Fragment key={`folder-group-${letter}`}>
                <Box sx={{ gridColumn: '1 / -1', mt: 2, mb: 1 }}>
                    <Typography variant="h6" color="text.secondary" sx={{ borderBottom: '1px solid #EAEAEA', pb: 1, pl: 1 }}>
                        Folders - {letter}
                    </Typography>
                </Box>
                {groups[letter].map(folder => (
                    <Box key={folder.id}>
                        <FolderCard 
                            folder={folder} 
                            selected={selectedFolders.has(folder.id)}
                            onSelect={() => onToggleFolder(folder.id)}
                            selectionMode={selectionMode}
                            onCopyItem={onCopyItem}
                            onCutItem={onCutItem}
                            viewMode={viewMode}
                        />
                    </Box>
                ))}
            </React.Fragment>
        ));
    };

    const renderFiles = () => {
        if (sortBy !== 'name') {
            return files.map(file => (
                <Box key={file.id}>
                    <FileCard 
                        file={file} 
                        selected={selectedFiles.has(file.id)}
                        onSelect={() => onToggleFile(file.id)}
                        selectionMode={selectionMode}
                        onCopyItem={onCopyItem}
                        onCutItem={onCutItem}
                        viewMode={viewMode}
                    />
                </Box>
            ));
        }

        const groups = {};
        files.forEach(file => {
            const letter = getFirstLetter(file.original_name || file.name);
            if (!groups[letter]) groups[letter] = [];
            groups[letter].push(file);
        });

        const sortedKeys = Object.keys(groups).sort();
        if (sortOrder === 'desc') sortedKeys.reverse();

        return sortedKeys.map(letter => (
            <React.Fragment key={`file-group-${letter}`}>
                <Box sx={{ gridColumn: '1 / -1', mt: 2, mb: 1 }}>
                    <Typography variant="h6" color="text.secondary" sx={{ borderBottom: '1px solid #EAEAEA', pb: 1, pl: 1 }}>
                        Files - {letter}
                    </Typography>
                </Box>
                {groups[letter].map(file => (
                    <Box key={file.id}>
                        <FileCard 
                            file={file} 
                            selected={selectedFiles.has(file.id)}
                            onSelect={() => onToggleFile(file.id)}
                            selectionMode={selectionMode}
                            onCopyItem={onCopyItem}
                            onCutItem={onCutItem}
                            viewMode={viewMode}
                        />
                    </Box>
                ))}
            </React.Fragment>
        ));
    };

    return (
        <Box sx={viewMode === 'list' ? { display: 'flex', flexDirection: 'column', gap: 1, pb: 4 } : { 
            display: 'grid', 
            gridTemplateColumns: { 
                xs: 'minmax(0, 1fr)', 
                sm: 'repeat(2, minmax(0, 1fr))', 
                md: 'repeat(3, minmax(0, 1fr))', 
                lg: 'repeat(4, minmax(0, 1fr))', 
                xl: 'repeat(5, minmax(0, 1fr))' 
            }, 
            gap: 3,
            pb: 4
        }}>
            {renderFolders()}
            {renderFiles()}
        </Box>
    );
}
