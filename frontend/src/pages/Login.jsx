import React, { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { Container, Paper, Typography, TextField, Button, Box, Alert, Link } from '@mui/material';

const schema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(1, "Password is required")
});

export default function Login() {
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
        const appId = String(import.meta.env.VITE_CAPTCHA_APP_ID);
        if (!window.TencentCaptcha) {
            setServerError("Captcha script not loaded.");
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
                }
            }, {});
            
            captchaRef.current = captcha;
            captcha.show();
        } catch (e) {
            console.error(e);
            setServerError("Failed to initialize Captcha: " + e.message);
        }
    };

    const executeLogin = async (payload) => {
        try {
            setServerError('');
            const response = await api.post('/auth/login', payload);
            
            const { accessToken, user } = response.data.data;
            setAuth(accessToken, user);
            navigate('/drive');
        } catch (err) {
            console.error(err);
            setServerError(err.response?.data?.message || err.message || 'Login failed');
        }
    };

    return (
        <Container component="main" maxWidth="xs" sx={{ height: '100vh', display: 'flex', alignItems: 'center' }}>
            <Paper elevation={0} sx={{ p: 4, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', border: '1px solid #EAEAEA', borderRadius: 2 }}>
                <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', flexDirection: 'column' }}>
                    <Box 
                        sx={{ 
                            width: 48, height: 48, borderRadius: 1.5, mb: 1.5,
                            background: 'linear-gradient(135deg, #37352F 0%, #73726E 100%)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff', fontSize: '24px', fontWeight: 'bold'
                        }}
                    >
                        C
                    </Box>
                    <Typography component="h1" variant="h5" fontWeight="bold">
                        CeguyyyDrive
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
                                border: '1px solid #c4c4c4 !important', // match TextField border
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
                        {isSubmitting ? 'Signing In...' : 'Sign In'}
                    </Button>
                    <Box textAlign="center">
                        <Typography variant="body2">
                            New here?{' '}
                            <Link component={RouterLink} to="/register" variant="body2" fontWeight="bold">
                                Create Account
                            </Link>
                        </Typography>
                    </Box>
                </Box>
            </Paper>
        </Container>
    );
}
