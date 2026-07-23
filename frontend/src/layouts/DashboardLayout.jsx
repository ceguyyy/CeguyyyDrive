import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import Header from '../components/layout/Header';
import UploadManager from '../components/ui/UploadManager';
import { Box } from '@mui/material';

export default function DashboardLayout() {
    return (
        <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
            <Sidebar />
            <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                <Header />
                <Box component="main" sx={{ flexGrow: 1, overflowY: 'auto', p: 3, position: 'relative' }}>
                    <Outlet />
                </Box>
            </Box>
            <UploadManager />
        </Box>
    );
}
