import { Link as RouterLink } from 'react-router-dom';
import { Button, Stack } from '@mui/material';
import { ArrowBack as BackIcon, PersonAddAlt as RegisterIcon } from '@mui/icons-material';

/**
 * The way out of an auth page, and across to the other one.
 *
 * A router link rather than history.back(): someone who arrived at /login from
 * an email or a bookmark has no history to go back to, and a button that does
 * nothing on a first visit is worse than no button. This always lands on the
 * landing page.
 *
 * `showRegister` is off on the register page itself, where the second button
 * would point at the page you are already on.
 */
export default function BackToHome({ showRegister = true, sx }) {
    return (
        <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ width: '100%', mb: 2, ...sx }}
        >
            <Button
                component={RouterLink}
                to="/"
                size="small"
                startIcon={<BackIcon fontSize="small" />}
                sx={{
                    textTransform: 'none', fontWeight: 600, color: '#73726E',
                    px: 1, '&:hover': { color: '#37352F', bgcolor: '#F1F1EF' }
                }}
            >
                Back to home
            </Button>

            {showRegister && (
                <Button
                    component={RouterLink}
                    to="/register"
                    size="small"
                    startIcon={<RegisterIcon fontSize="small" />}
                    sx={{
                        textTransform: 'none', fontWeight: 700, color: '#37352F',
                        px: 1, '&:hover': { bgcolor: '#F1F1EF' }
                    }}
                >
                    Register
                </Button>
            )}
        </Stack>
    );
}
