import { Link as RouterLink } from 'react-router-dom';
import { Box, Button } from '@mui/material';
import { ArrowBack as BackIcon } from '@mui/icons-material';

/**
 * The way out of an auth page, back to the landing page.
 *
 * A router link rather than history.back(): someone who arrived at /login from
 * an email or a bookmark has no history to go back to, and a button that does
 * nothing on a first visit is worse than no button.
 *
 * Deliberately only the one control. Each auth page already carries a link to
 * its counterpart at the foot of the form ("Create Account", "Sign In"), and a
 * second copy up here says the same thing twice.
 */
export default function BackToHome({ sx }) {
    return (
        <Box sx={{ width: '100%', mb: 2, ...sx }}>
            <Button
                component={RouterLink}
                to="/"
                size="small"
                startIcon={<BackIcon fontSize="small" />}
                sx={{
                    textTransform: 'none', fontWeight: 600, color: '#73726E',
                    px: 1, ml: -1,
                    '&:hover': { color: '#37352F', bgcolor: '#F1F1EF' }
                }}
            >
                Back to home
            </Button>
        </Box>
    );
}
