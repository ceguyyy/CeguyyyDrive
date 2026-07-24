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
    fullName: z.string().min(2, "Full Name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters")
});

export default function Register() {
    const navigate = useNavigate();
    const setAuth = useAuthStore(state => state.setAuth);
    const [serverError, setServerError] = useState('');

    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
        resolver: zodResolver(schema)
    });

    const dataRef = React.useRef(null);
    const captchaRef = React.useRef(null);

    const onSubmit = (data) => {
        dataRef.current = data;
        const appId = import.meta.env.VITE_CAPTCHA_APP_ID || '209214731';
        if (!window.TencentCaptcha) {
            console.warn("Captcha script not loaded, proceeding with direct registration fallback.");
            executeRegister(data);
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
                    await executeRegister({
                        ...data,
                        ticket: res.ticket,
                        randstr: res.randstr
                    });
                } else {
                    await executeRegister(data);
                }
            }, {});
            
            captchaRef.current = captcha;
            captcha.show();
        } catch (e) {
            console.warn("Captcha initialization error, proceeding with direct registration.", e);
            executeRegister(data);
        }
    };

    const executeRegister = async (payload) => {
        try {
            setServerError('');
            const response = await api.post('/auth/register', payload);
            
            const { accessToken, user } = response.data.data;
            setAuth(accessToken, user);
            navigate('/drive');
        } catch (err) {
            setServerError(err.response?.data?.message || 'Registration failed');
        }
    };

    return (
        <Container component="main" maxWidth="xs" sx={{ height: '100vh', display: 'flex', alignItems: 'center' }}>
            <Paper elevation={0} sx={{ p: 4, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', border: '1px solid #EAEAEA', borderRadius: 2 }}>
                <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', flexDirection: 'column' }}>
                    <CloudLogo size={56} sx={{ mb: 1.5 }} />
                    <Typography component="h1" variant="h5" fontWeight="bold">
                        Create Account
                    </Typography>
                </Box>
                {serverError && (
                    <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
                        {serverError}
                    </Alert>
                )}

                <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ width: '100%', mt: 1 }}>
                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        id="fullName"
                        label="Full Name"
                        autoComplete="name"
                        autoFocus
                        {...register('fullName')}
                        error={!!errors.fullName}
                        helperText={errors.fullName?.message}
                    />
                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        id="email"
                        label="Email Address"
                        autoComplete="email"
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
                        autoComplete="new-password"
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
                                border: '1px solid #c4c4c4 !important', // match TextField border
                                borderRadius: '4px !important'
                            }
                        }}
                    ></Box>
                    <Button
                        type="submit"
                        fullWidth
                        variant="contained"
                        color="secondary"
                        sx={{ mt: 3, mb: 2, py: 1.5 }}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Creating...' : 'Create Account'}
                    </Button>
                    <Box textAlign="center">
                        <Typography variant="body2">
                            Already have an account?{' '}
                            <Link component={RouterLink} to="/login" variant="body2" fontWeight="bold">
                                Sign In
                            </Link>
                        </Typography>
                    </Box>
                </Box>
            </Paper>
        </Container>
    );
}
