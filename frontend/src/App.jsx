import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { isSuperAdmin } from './utils/roles';

import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
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
import BillingManagementPage from './pages/BillingManagementPage';
import LandingPage from './pages/LandingPage';
import IntegrationPage from './pages/IntegrationPage';

const ProtectedRoute = ({ children }) => {
    const { token } = useAuthStore();

    // Sent to the landing page rather than straight to /login: someone who has
    // never signed in needs the pitch, not a password box.
    if (!token) return <Navigate to="/" replace />;
    return children;
};

// Typing /billing directly must not render the console shell. The API already
// rejects non-admins, so the page would only paint empty tables and a
// permission error — it should not appear at all.
const SuperAdminRoute = ({ children }) => {
    const { user } = useAuthStore();

    // `user` is null until fetchMe resolves; redirecting then would bounce a
    // legitimate admin on a hard refresh.
    if (!user) return null;
    if (!isSuperAdmin(user)) return <Navigate to="/drive" replace />;
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
            <Route path="/forgot-password" element={<ForgotPassword />} />
            {/* Platform-admin registration lives on its own unlisted path rather
                than as a tab on /register. The beta access keys are still what
                actually gate the role — this only stops advertising it. */}
            <Route path="/ceguyyyy-admin-billing" element={<Register platformAdminOnly />} />
            
            {/* The root is public now. A signed-in visitor has no use for the
                marketing page, so they go straight to their drive. */}
            <Route path="/" element={token ? <Navigate to="/drive" replace /> : <LandingPage />} />

            {/* A layout route with no path of its own: the app shell wraps these
                children without owning "/", which the landing page needs. Children
                therefore carry absolute paths. */}
            <Route element={
                <ProtectedRoute>
                    <DashboardLayout />
                </ProtectedRoute>
            }>
                <Route path="/drive" element={<Dashboard />} />
                <Route path="/drive/folders/:folderId" element={<Dashboard />} />
                <Route path="/starred" element={<StarredFiles />} />
                <Route path="/company-drive/:orgId" element={<CompanyDrivePage />} />
                <Route path="/company-drive/:orgId/folders/:folderId" element={<CompanyDrivePage />} />
                <Route path="/company-drive/:orgId/trash" element={<CompanyDriveTrash />} />
                <Route path="/shared" element={<SharedWithMe />} />
                <Route path="/approvals" element={<ApprovalsPage />} />
                <Route path="/organization" element={<OrganizationSettings />} />
                <Route path="/integration" element={<IntegrationPage />} />
                <Route path="/trash" element={<Trash />} />
                <Route path="/chat" element={<ChatPage />} />
                <Route path="/billing" element={
                    <SuperAdminRoute>
                        <BillingManagementPage />
                    </SuperAdminRoute>
                } />
            </Route>

            {/* An unknown URL sends a guest to the landing page directly. Routing
                them to /drive would only bounce off ProtectedRoute and land here
                anyway, one redirect later. */}
            <Route path="*" element={<Navigate to={token ? '/drive' : '/'} replace />} />
        </Routes>
    );
}
