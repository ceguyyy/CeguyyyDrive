import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';

import Login from './pages/Login';
import Register from './pages/Register';
import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard';
import Trash from './pages/Trash';
import PublicShare from './pages/PublicShare';
import ChatPage from './pages/ChatPage';

import SharedWithMe from './pages/SharedWithMe';
import ApprovalsPage from './pages/ApprovalsPage';
import OrganizationSettings from './pages/OrganizationSettings';
import StarredFiles from './pages/StarredFiles';
import CompanyDrivePage from './pages/CompanyDrivePage';
import CompanyDriveTrash from './pages/CompanyDriveTrash';

const ProtectedRoute = ({ children }) => {
    const { token } = useAuthStore();
    
    if (!token) return <Navigate to="/login" replace />;
    return children;
};

export default function App() {
    const { token, fetchMe } = useAuthStore();

    useEffect(() => {
        if (token) {
            fetchMe();
        }
    }, [token, fetchMe]);

    return (
        <Routes>
            <Route path="/s/:token" element={<PublicShare />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
            <Route path="/" element={
                <ProtectedRoute>
                    <DashboardLayout />
                </ProtectedRoute>
            }>
                <Route index element={<Navigate to="/drive" replace />} />
                <Route path="drive" element={<Dashboard />} />
                <Route path="drive/folders/:folderId" element={<Dashboard />} />
                <Route path="starred" element={<StarredFiles />} />
                <Route path="company-drive/:orgId" element={<CompanyDrivePage />} />
                <Route path="company-drive/:orgId/folders/:folderId" element={<CompanyDrivePage />} />
                <Route path="company-drive/:orgId/trash" element={<CompanyDriveTrash />} />
                <Route path="shared" element={<SharedWithMe />} />
                <Route path="approvals" element={<ApprovalsPage />} />
                <Route path="organization" element={<OrganizationSettings />} />
                <Route path="trash" element={<Trash />} />
                <Route path="chat" element={<ChatPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/drive" replace />} />
        </Routes>
    );
}
