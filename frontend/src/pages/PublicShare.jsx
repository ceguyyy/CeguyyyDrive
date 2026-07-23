import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { InsertDriveFile as DocumentIcon, Error as ErrorIcon } from '@mui/icons-material';
import { Box, Typography, Button, CircularProgress, Card, CardContent, Container } from '@mui/material';

const publicApi = axios.create({
    baseURL: 'http://localhost:8080/v1'
});

export default function PublicShare() {
    const { token } = useParams();

    const { data, isLoading, error } = useQuery({
        queryKey: ['share', token],
        queryFn: async () => {
            const res = await publicApi.get(`/shares/${token}`);
            return res.data.data;
        }
    });

    if (isLoading) return (
        <Box sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress />
        </Box>
    );
    
    if (error) return (
        <Container component="main" maxWidth="sm" sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Card elevation={3} sx={{ width: '100%', textAlign: 'center', p: 4 }}>
                <ErrorIcon sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
                <Typography variant="h4" fontWeight="bold" color="error" gutterBottom>
                    Link Invalid
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    {error.response?.data?.message || 'Invalid or expired share link'}
                </Typography>
            </Card>
        </Container>
    );

    const { file, downloadUrl } = data;

    return (
        <Container component="main" maxWidth="sm" sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Card elevation={3} sx={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', p: 4 }}>
                <Box sx={{ 
                    width: 120, height: 120, borderRadius: '50%', 
                    bgcolor: 'primary.light', display: 'flex', 
                    alignItems: 'center', justifyContent: 'center', mb: 4 
                }}>
                    <DocumentIcon sx={{ fontSize: 64, color: 'primary.main' }} />
                </Box>
                
                <Box sx={{ width: '100%', textAlign: 'center', mb: 4 }}>
                    <Typography variant="h5" fontWeight="bold" noWrap title={file.name}>
                        {file.name}
                    </Typography>
                    <Typography variant="subtitle1" color="text.secondary">
                        Shared File
                    </Typography>
                </Box>

                <Button 
                    href={downloadUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    variant="contained"
                    color="primary"
                    size="large"
                    fullWidth
                    sx={{ py: 2, fontSize: '1.2rem', fontWeight: 'bold' }}
                >
                    Download File
                </Button>
            </Card>
        </Container>
    );
}
