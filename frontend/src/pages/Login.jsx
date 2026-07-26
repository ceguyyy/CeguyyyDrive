import React, { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { Container, Paper, Typography, TextField, Button, Box, Alert, Link } from '@mui/material';

import CloudLogo from '../components/ui/CloudLogo';

const schema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(1, "Password is required")
});

export default function Login() {
    const navigate = useNavigate();
    const setAuth = useAuthStore(state => state.setAuth);
    const [serverError, setServerError] = useState('');
    const [step, setStep] = useState('credentials'); // 'credentials' | 'otp'
    const [pendingEmail, setPendingEmail] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [otpMessage, setOtpMessage] = useState('');
    const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
    const [isResendingOtp, setIsResendingOtp] = useState(false);

    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
        resolver: zodResolver(schema)
    });
    
    const dataRef = React.useRef(null);
    const captchaRef = React.useRef(null);

    const onSubmit = (data) => {
        dataRef.current = data;
        const appId = String(import.meta.env.VITE_CAPTCHA_APP_ID || '209214731');
        if (!window.TencentCaptcha) {
            console.warn("Captcha script not loaded, proceeding with direct login fallback.");
            executeLogin(data);
            return;
        }

        try {
            const container = document.getElementById('captcha-container');
            if (container) container.innerHTML = ''; // Clear previous captcha instances
            
            if (captchaRef.current && captchaRef.current.destroy) {
                try { captchaRef.current.destroy(); } catch(e) {}
            }

            const captcha = new window.TencentCaptcha(container, appId, async (res) => {
                if (res.ret === 0) {
                    await executeLogin({
                        ...data,
                        ticket: res.ticket,
                        randstr: res.randstr
                    });
                } else {
                    setServerError('Captcha verification was canceled or failed.');
                }
            }, {});
            
            captchaRef.current = captcha;
            captcha.show();
        } catch (e) {
            console.error("TencentCaptcha init error:", e);
            executeLogin(data);
        }
    };

    const executeLogin = async (payload) => {
        setServerError('');
        try {
            const res = await api.post('/auth/login', payload);
            if (res.data?.data?.requiresOtp) {
                setPendingEmail(res.data.data.email);
                setOtpMessage(res.data.data.message || 'OTP sent via Telegram (Expires in 5 minutes)');
                setStep('otp');
            } else {
                const { accessToken, token, user } = res.data.data;
                const validToken = accessToken || token;
                setAuth(validToken, user);
                navigate('/drive');
            }
        } catch (err) {
            setServerError(err.response?.data?.message || err.message || 'Login failed');
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

    return (
        <Container component="main" maxWidth="xs" sx={{ height: '100vh', display: 'flex', alignItems: 'center' }}>
            <Paper elevation={0} sx={{ p: 4, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', border: '1px solid #EAEAEA', borderRadius: 2 }}>
                <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', flexDirection: 'column' }}>
                    <CloudLogo size={56} sx={{ mb: 1.5 }} />
                    <Typography component="h1" variant="h5" fontWeight="bold">
                        {step === 'otp' ? 'Email OTP Verification' : 'CeguyyyDrive'}
                    </Typography>
                </Box>

                {serverError && (
                    <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
                        {serverError}
                    </Alert>
                )}

                {step === 'credentials' ? (
                    <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ width: '100%', mt: 1 }}>
                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            id="email"
                            label="Email Address"
                            autoComplete="email"
                            autoFocus
                            {...register('email')}
                            error={!!errors.email}
                            helperText={errors.email?.message}
                        />
                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            label="Password"
                            type="password"
                            id="password"
                            autoComplete="current-password"
                            {...register('password')}
                            error={!!errors.password}
                            helperText={errors.password?.message}
                        />
                        <Box 
                            id="captcha-container" 
                            sx={{ 
                                width: '100%', 
                                mt: 2,
                                '& iframe': {
                                    width: '100% !important',
                                    border: '1px solid #c4c4c4 !important',
                                    borderRadius: '4px !important'
                                }
                            }}
                        ></Box>
                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            sx={{ mt: 3, mb: 2, py: 1.5 }}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? 'Requesting OTP...' : 'Sign In'}
                        </Button>
                        <Box textAlign="center">
                            <Typography variant="body2" sx={{ mb: 1 }}>
                                <Link component={RouterLink} to="/forgot-password" variant="body2" fontWeight="bold">
                                    Forgot your password?
                                </Link>
                            </Typography>
                            <Typography variant="body2">
                                New here?{' '}
                                <Link component={RouterLink} to="/register" variant="body2" fontWeight="bold">
                                    Create Account
                                </Link>
                            </Typography>
                        </Box>
                    </Box>
                ) : (
                    <Box component="form" onSubmit={handleVerifyOtp} sx={{ width: '100%', mt: 1 }}>
                        <Alert severity="info" sx={{ width: '100%', mb: 2 }}>
                            {otpMessage || 'OTP code sent to your email. Valid for 5 minutes.'}
                        </Alert>
                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            id="otpCode"
                            label="6-Digit Verification Code"
                            placeholder="123456"
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value)}
                            inputProps={{ maxLength: 6, style: { textAlign: 'center', fontSize: '1.25rem', letterSpacing: '0.5rem' } }}
                            autoFocus
                        />
                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            sx={{ mt: 3, mb: 1, py: 1.5 }}
                            disabled={isVerifyingOtp || isResendingOtp}
                        >
                            {isVerifyingOtp ? 'Verifying OTP...' : 'Verify OTP & Enter'}
                        </Button>
                        <Button
                            type="button"
                            fullWidth
                            variant="outlined"
                            color="secondary"
                            onClick={handleResendOtp}
                            disabled={isResendingOtp || isVerifyingOtp}
                            sx={{ mb: 2, py: 1 }}
                        >
                            {isResendingOtp ? 'Resending Code...' : 'Resend OTP Code'}
                        </Button>
                        <Box textAlign="center">
                            <Button variant="text" size="small" onClick={() => setStep('credentials')}>
                                Back to Sign In
                            </Button>
                        </Box>
                    </Box>
                )}
            </Paper>
        </Container>
    );
}
