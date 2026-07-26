import { useState } from 'react';
import { useNavigate, useSearchParams, Link as RouterLink } from 'react-router-dom';
import {
    Container, Paper, Typography, TextField, Button, Box, Alert, Link, Stack,
    InputAdornment, IconButton
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import api from '../services/api';
import CloudLogo from '../components/ui/CloudLogo';
import { runCaptcha } from '../utils/captcha';

const MIN_PASSWORD_LENGTH = 8;

/**
 * Two-step password reset: request a code by email, then redeem it.
 *
 * The request step always reports success, mirroring the server, so this page
 * cannot be used to discover which email addresses are registered.
 */
export default function ForgotPassword() {
    const navigate = useNavigate();

    // Profile Settings links here as /forgot-password?email=<address> so a
    // signed-in user who cannot recall their current password does not have to
    // retype it. The code still goes to the mailbox, so this prefill grants
    // nothing on its own.
    const [searchParams] = useSearchParams();
    const prefilledEmail = searchParams.get('email') || '';

    const [step, setStep] = useState('request');
    const [email, setEmail] = useState(prefilledEmail);
    const [otpCode, setOtpCode] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    // This endpoint mails an address the caller supplies, so it is exactly what
    // a bot would abuse — and the server verifies the ticket for real.
    //
    // A failed challenge therefore stops here. Sending anyway, ticketless, only
    // produced a guaranteed 400 that read to the user as "the email never
    // arrived" rather than "the captcha did not run".
    const requestCode = async (event) => {
        event.preventDefault();
        setError('');

        try {
            const { ticket, randstr } = await runCaptcha('forgot-captcha-container');
            await sendRequest({ ticket, randstr });
        } catch (err) {
            setError(err.message);
        }
    };

    const sendRequest = async (captchaFields = {}) => {
        setIsSubmitting(true);
        try {
            const res = await api.post('/auth/forgot-password', {
                email: email.trim(),
                ...captchaFields
            });
            setNotice(res.data.data.message);
            setStep('reset');
        } catch (err) {
            setError(err.response?.data?.message || 'Could not send a reset code. Try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const submitReset = async (event) => {
        event.preventDefault();
        setError('');

        if (newPassword.length < MIN_PASSWORD_LENGTH) {
            setError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
            return;
        }

        // Caught here rather than server-side: a typo in a password the user
        // cannot see is the whole reason the second field exists.
        if (newPassword !== confirmPassword) {
            setError('The two passwords do not match.');
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await api.post('/auth/reset-password', {
                email: email.trim(),
                otpCode: otpCode.trim(),
                newPassword
            });
            navigate('/login', { state: { notice: res.data.data.message } });
        } catch (err) {
            setError(err.response?.data?.message || 'Could not reset your password. Try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Container component="main" maxWidth="sm" sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', py: 6 }}>
            <Paper
                elevation={0}
                sx={{
                    p: { xs: 3, sm: 5 }, width: '100%', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', border: '1px solid #EAEAEA', borderRadius: 3,
                    boxShadow: '0 10px 30px rgba(0,0,0,0.04)'
                }}
            >
                <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', flexDirection: 'column' }}>
                    <CloudLogo size={56} sx={{ mb: 1.5 }} />
                    <Typography component="h1" variant="h5" fontWeight="800" sx={{ letterSpacing: '-0.5px' }}>
                        Reset your password
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, textAlign: 'center' }}>
                        {step === 'request'
                            ? 'We will email you a one-time code.'
                            : 'Enter the code from your email and choose a new password.'}
                    </Typography>
                </Box>

                {error && <Alert severity="error" sx={{ width: '100%', mb: 3, borderRadius: 2 }}>{error}</Alert>}
                {notice && step === 'reset' && (
                    <Alert severity="success" sx={{ width: '100%', mb: 3, borderRadius: 2 }}>{notice}</Alert>
                )}

                {step === 'request' ? (
                    <Box component="form" onSubmit={requestCode} sx={{ width: '100%' }}>
                        <Stack spacing={2}>
                            <TextField
                                required fullWidth type="email" label="Email Address"
                                value={email} onChange={(e) => setEmail(e.target.value)}
                                autoComplete="email" autoFocus
                            />
                            <Button
                                type="submit" fullWidth variant="contained" size="large"
                                disabled={isSubmitting || !email.trim()}
                                sx={{ py: 1.4, borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
                            >
                                {isSubmitting ? 'Sending…' : 'Send Reset Code'}
                            </Button>
                            <Box id="forgot-captcha-container" />
                        </Stack>
                    </Box>
                ) : (
                    <Box component="form" onSubmit={submitReset} sx={{ width: '100%' }}>
                        <Stack spacing={2}>
                            <TextField
                                required fullWidth label="Reset Code"
                                value={otpCode}
                                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                                inputProps={{ inputMode: 'numeric', maxLength: 6 }}
                                autoFocus
                                helperText="6-digit code, valid for 15 minutes."
                            />
                            <TextField
                                required fullWidth label="New Password"
                                type={showPassword ? 'text' : 'password'}
                                value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                                autoComplete="new-password"
                                helperText={`At least ${MIN_PASSWORD_LENGTH} characters.`}
                                InputProps={{
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton onClick={() => setShowPassword(v => !v)} edge="end">
                                                {showPassword ? <VisibilityOff /> : <Visibility />}
                                            </IconButton>
                                        </InputAdornment>
                                    )
                                }}
                            />
                            <TextField
                                required fullWidth label="Retype New Password"
                                type={showPassword ? 'text' : 'password'}
                                value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                                autoComplete="new-password"
                                error={!!confirmPassword && confirmPassword !== newPassword}
                                helperText={
                                    confirmPassword && confirmPassword !== newPassword
                                        ? 'Passwords do not match.'
                                        : 'Type it again to confirm.'
                                }
                            />
                            <Button
                                type="submit" fullWidth variant="contained" size="large"
                                disabled={isSubmitting || !otpCode.trim() || !newPassword || !confirmPassword}
                                sx={{ py: 1.4, borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
                            >
                                {isSubmitting ? 'Updating…' : 'Set New Password'}
                            </Button>
                            <Button
                                fullWidth variant="text" size="small"
                                disabled={isSubmitting}
                                onClick={() => { setStep('request'); setOtpCode(''); setError(''); setNotice(''); }}
                                sx={{ textTransform: 'none' }}
                            >
                                Use a different email or resend the code
                            </Button>
                        </Stack>
                    </Box>
                )}

                <Typography variant="body2" sx={{ mt: 3 }}>
                    Remembered it? <Link component={RouterLink} to="/login" fontWeight={600}>Sign In</Link>
                </Typography>
            </Paper>
        </Container>
    );
}
