import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link as RouterLink } from 'react-router-dom';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { Container, Paper, Typography, TextField, Button, Box, Alert, Link, Tabs, Tab, Divider, Stack, InputAdornment, IconButton } from '@mui/material';
import { Business as OrgIcon, Group as MemberIcon, MarkEmailRead as EmailIcon, Visibility, VisibilityOff } from '@mui/icons-material';
import CloudLogo from '../components/ui/CloudLogo';

const PLATFORM_ADMIN_TAB = 2;

/**
 * `platformAdminOnly` renders the admin form on its own route
 * (/ceguyyyy-admin-billing) and drops the tab strip, so the public /register
 * page never advertises that platform-admin registration exists.
 *
 * This is discoverability, not access control: authService.register still
 * requires both beta access keys, and that check is what actually gates the role.
 */
export default function Register({ platformAdminOnly = false }) {
    const navigate = useNavigate();
    const setAuth = useAuthStore(state => state.setAuth);

    // Invitation emails link to /register?orgId=<uuid>, which opens the Join
    // tab with the organization already filled in.
    const [searchParams] = useSearchParams();
    const invitedOrgId = searchParams.get('orgId') || '';

    // Tab State: 0 = Org Owner, 1 = Join Org (Member), 2 = Platform Admin
    const [tabIndex, setTabIndex] = useState(
        platformAdminOnly ? PLATFORM_ADMIN_TAB : (invitedOrgId ? 1 : 0)
    );

    // Common Fields
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    // Tab 0 Fields (Org Owner)
    const [orgName, setOrgName] = useState('');
    const [licenseKey, setLicenseKey] = useState('');
    const [showLicenseKey, setShowLicenseKey] = useState(false);

    // Tab 1 Fields (Join Org)
    const [orgId, setOrgId] = useState(invitedOrgId);

    // Tab 2 Fields (Platform Admin / Dev)
    const [accessKey, setAccessKey] = useState('');
    const [secondaryAccessKey, setSecondaryAccessKey] = useState('');

    // UI Status State
    const [serverError, setServerError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [step, setStep] = useState('register'); // 'register' | 'otp'
    const [pendingEmail, setPendingEmail] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [otpMessage, setOtpMessage] = useState('');
    const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
    const [isResendingOtp, setIsResendingOtp] = useState(false);

    const handleTabChange = (event, newValue) => {
        setTabIndex(newValue);
        setServerError('');
    };

    const validateForm = () => {
        if (!fullName.trim() || fullName.length < 2) return "Full Name must be at least 2 characters.";
        if (!email.trim() || !email.includes('@')) return "Please enter a valid email address.";
        if (!password || password.length < 8) return "Password must be at least 8 characters.";

        if (tabIndex === 0) {
            if (!orgName.trim()) return "Organization Name is required.";
            if (!licenseKey.trim()) return "License Key is required to create a new organization.";
        } else if (tabIndex === 1) {
            if (!orgId.trim()) return "Organization ID or Invite Code is required to join.";
        } else if (tabIndex === 2) {
            if (!accessKey.trim() || !secondaryAccessKey.trim()) {
                return "Both Primary and Secondary Beta Access Keys are required for Platform Admin registration.";
            }
        }
        return null;
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        const validationError = validateForm();
        if (validationError) {
            setServerError(validationError);
            return;
        }

        setIsSubmitting(true);
        setServerError('');

        let payload = {
            fullName: fullName.trim(),
            email: email.trim(),
            password: password
        };

        if (tabIndex === 0) {
            // Organization Owner (New Org)
            payload.roleName = 'user';
            payload.role = 'user';
            payload.orgName = orgName.trim();
            payload.licenseKey = licenseKey.trim();
        } else if (tabIndex === 1) {
            // Team Member Joining Existing Org
            payload.roleName = 'user';
            payload.role = 'user';
            payload.orgId = orgId.trim();
        } else if (tabIndex === 2) {
            // Platform Admin / Developer
            payload.roleName = 'owner';
            payload.role = 'owner';
            payload.accessKey = accessKey.trim();
            payload.secondaryAccessKey = secondaryAccessKey.trim();
        }

        try {
            const response = await api.post('/auth/register', payload);
            const data = response.data.data;
            if (data.requiresOtp) {
                setPendingEmail(data.email);
                setOtpMessage(data.message || 'OTP sent to your email via Email. Valid for 5 minutes.');
                setStep('otp');
            } else {
                const { accessToken, token, user } = data;
                const validToken = accessToken || token;
                setAuth(validToken, user);
                navigate('/drive');
            }
        } catch (err) {
            setServerError(err.response?.data?.message || 'Registration failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        if (!otpCode || otpCode.length !== 6) {
            setServerError('Please enter a valid 6-digit OTP code');
            return;
        }
        setIsVerifyingOtp(true);
        setServerError('');
        try {
            const res = await api.post('/auth/verify-otp', {
                email: pendingEmail,
                otpCode: otpCode.trim()
            });
            const { accessToken, token, user } = res.data.data;
            const validToken = accessToken || token;
            setAuth(validToken, user);
            navigate('/drive');
        } catch (err) {
            setServerError(err.response?.data?.message || 'Invalid or expired OTP code');
        } finally {
            setIsVerifyingOtp(false);
        }
    };

    const handleResendOtp = async () => {
        if (!pendingEmail) return;
        setIsResendingOtp(true);
        setServerError('');
        try {
            const res = await api.post('/auth/resend-otp', { email: pendingEmail });
            setOtpMessage(res.data?.data?.message || 'A new verification code has been sent.');
        } catch (err) {
            setServerError(err.response?.data?.message || 'Failed to resend OTP code');
        } finally {
            setIsResendingOtp(false);
        }
    };

    return (
        <Container component="main" maxWidth="sm" sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', py: 6 }}>
            <Paper elevation={0} sx={{ p: { xs: 3, sm: 5 }, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', border: '1px solid #EAEAEA', borderRadius: 3, boxShadow: '0 10px 30px rgba(0,0,0,0.04)' }}>
                <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', flexDirection: 'column' }}>
                    <CloudLogo size={56} sx={{ mb: 1.5 }} />
                    <Typography component="h1" variant="h5" fontWeight="800" sx={{ letterSpacing: '-0.5px' }}>
                        {platformAdminOnly ? 'Platform Admin Registration' : 'Create AbuGreySoft Box Account'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {platformAdminOnly
                            ? 'Restricted. Both beta access keys are required.'
                            : 'Select your registration tier below to get started'}
                    </Typography>
                </Box>

                {serverError && (
                    <Alert severity="error" sx={{ width: '100%', mb: 3, borderRadius: 2 }}>
                        {serverError}
                    </Alert>
                )}

                {step === 'register' ? (
                    <Box component="form" onSubmit={onSubmit} sx={{ width: '100%' }}>
                        {/* The Platform Admin tab is gone from the public page;
                            that form lives at /ceguyyyy-admin-billing instead. */}
                        {!platformAdminOnly && (
                            <Tabs
                                value={tabIndex}
                                onChange={handleTabChange}
                                variant="fullWidth"
                                sx={{ mb: 3, borderBottom: 1, borderColor: 'divider', '& .MuiTab-root': { py: 1.5, fontWeight: 600, textTransform: 'none', fontSize: '0.9rem' } }}
                            >
                                <Tab icon={<OrgIcon sx={{ mb: 0.5 }} />} label="Org Owner" />
                                <Tab icon={<MemberIcon sx={{ mb: 0.5 }} />} label="Join Org" />
                            </Tabs>
                        )}

                        {/* Tab 0 Description */}
                        {tabIndex === 0 && (
                            <Alert severity="info" sx={{ mb: 3, borderRadius: 2, fontSize: '0.85rem' }}>
                                Register as an **Organization Owner** by entering your custom workspace name and the **License Key** issued by the developer.
                            </Alert>
                        )}

                        {/* Tab 1 Description */}
                        {tabIndex === 1 && (
                            <Alert severity="info" sx={{ mb: 3, borderRadius: 2, fontSize: '0.85rem' }}>
                                Join an existing organization as a **Team Member**. Enter the **Organization ID or Invite Code** provided by your workplace manager. No beta keys required.
                            </Alert>
                        )}

                        {/* Tab 2 Description */}
                        {tabIndex === 2 && (
                            <Alert severity="warning" sx={{ mb: 3, borderRadius: 2, fontSize: '0.85rem' }}>
                                **Developer / Platform Admin Access**: Requires Primary and Secondary Beta Access Keys. Grants access to the **Super Admin Billing Console** (`/billing`).
                            </Alert>
                        )}

                        <Stack spacing={2}>
                            <TextField
                                required
                                fullWidth
                                label="Full Name"
                                placeholder="John Doe"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                            />
                            <TextField
                                required
                                fullWidth
                                label="Email Address"
                                type="email"
                                placeholder="name@company.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                            <TextField
                                required
                                fullWidth
                                label="Password"
                                type="password"
                                placeholder="At least 8 characters"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />

                            {/* Conditional Tab 0 Fields */}
                            {tabIndex === 0 && (
                                <>
                                    <Divider sx={{ my: 1 }} />
                                    <TextField
                                        required
                                        fullWidth
                                        label="Organization / Company Name"
                                        placeholder="e.g. Acme Corp Workspace"
                                        value={orgName}
                                        onChange={(e) => setOrgName(e.target.value)}
                                    />
                                    <TextField
                                        required
                                        fullWidth
                                        type={showLicenseKey ? 'text' : 'password'}
                                        label="License Key"
                                        placeholder="Enter License Key (e.g. LIC-PRO-...)"
                                        value={licenseKey}
                                        onChange={(e) => setLicenseKey(e.target.value)}
                                        helperText="Issued from Developer Billing Console"
                                        InputProps={{
                                            endAdornment: (
                                                <InputAdornment position="end">
                                                    <IconButton
                                                        aria-label="toggle license key visibility"
                                                        onClick={() => setShowLicenseKey(!showLicenseKey)}
                                                        edge="end"
                                                        size="small"
                                                    >
                                                        {showLicenseKey ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                                                    </IconButton>
                                                </InputAdornment>
                                            )
                                        }}
                                    />
                                </>
                            )}

                            {/* Conditional Tab 1 Fields */}
                            {tabIndex === 1 && (
                                <>
                                    <Divider sx={{ my: 1 }} />
                                    <TextField
                                        required
                                        fullWidth
                                        label="Organization ID / Invite Code"
                                        placeholder="Enter Org ID from your manager"
                                        value={orgId}
                                        onChange={(e) => setOrgId(e.target.value)}
                                        helperText="You will be added as a team member"
                                    />
                                </>
                            )}

                            {/* Conditional Tab 2 Fields */}
                            {tabIndex === 2 && (
                                <>
                                    <Divider sx={{ my: 1 }} />
                                    <TextField
                                        required
                                        fullWidth
                                        type="password"
                                        label="Primary Beta Access Key"
                                        placeholder="Enter Primary Beta Key"
                                        value={accessKey}
                                        onChange={(e) => setAccessKey(e.target.value)}
                                    />
                                    <TextField
                                        required
                                        fullWidth
                                        type="password"
                                        label="Secondary Beta Access Key"
                                        placeholder="Enter Secondary Beta Key"
                                        value={secondaryAccessKey}
                                        onChange={(e) => setSecondaryAccessKey(e.target.value)}
                                    />
                                </>
                            )}
                        </Stack>

                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            color="primary"
                            size="large"
                            sx={{ mt: 4, mb: 2, py: 1.5, fontWeight: 700, borderRadius: 2 }}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? 'Creating Account...' : tabIndex === 2 ? 'Register as Platform Admin' : tabIndex === 0 ? 'Create Organization' : 'Join Organization'}
                        </Button>
                        <Box textAlign="center">
                            <Typography variant="body2" color="text.secondary">
                                Already have an account?{' '}
                                <Link component={RouterLink} to="/login" variant="body2" fontWeight="bold">
                                    Sign In
                                </Link>
                            </Typography>
                        </Box>
                    </Box>
                ) : (
                    <Box component="form" onSubmit={handleVerifyOtp} sx={{ width: '100%', mt: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                            <EmailIcon sx={{ fontSize: 48, color: 'primary.main', opacity: 0.8 }} />
                        </Box>
                        <Alert severity="success" sx={{ width: '100%', mb: 3, borderRadius: 2 }}>
                            {otpMessage || 'OTP verification code sent to your email via Email.'}
                        </Alert>
                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            label="6-Digit Verification Code"
                            placeholder="123456"
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value)}
                            inputProps={{ maxLength: 6, style: { textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5rem', fontWeight: 'bold' } }}
                            autoFocus
                        />
                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            size="large"
                            sx={{ mt: 3, mb: 1, py: 1.5, fontWeight: 700, borderRadius: 2 }}
                            disabled={isVerifyingOtp || isResendingOtp}
                        >
                            {isVerifyingOtp ? 'Verifying Code...' : 'Verify Email & Complete Registration'}
                        </Button>
                        <Button
                            type="button"
                            fullWidth
                            variant="outlined"
                            color="secondary"
                            onClick={handleResendOtp}
                            disabled={isResendingOtp || isVerifyingOtp}
                            sx={{ mb: 2, py: 1, borderRadius: 2 }}
                        >
                            {isResendingOtp ? 'Resending Code...' : 'Resend OTP Code'}
                        </Button>
                        <Box textAlign="center">
                            <Button variant="text" size="small" onClick={() => setStep('register')}>
                                Back to Registration
                            </Button>
                        </Box>
                    </Box>
                )}
            </Paper>
        </Container>
    );
}
