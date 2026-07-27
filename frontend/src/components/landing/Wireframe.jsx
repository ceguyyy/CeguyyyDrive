import { Box, Typography } from '@mui/material';

/**
 * A placeholder standing in for artwork that does not exist yet.
 *
 * States its intended pixel dimensions on the face, so whoever supplies the
 * image knows what to produce and nobody has to measure the layout to find out.
 * The box itself is fluid — `width` and `height` are the target export size, not
 * a fixed frame — and it holds its shape with an aspect ratio so swapping in the
 * real image later changes nothing about the surrounding layout.
 */
export default function Wireframe({ width, height, label, sx }) {
    return (
        <Box
            role="img"
            aria-label={`Placeholder for ${label || 'image'}, ${width} by ${height} pixels`}
            sx={{
                width: '100%',
                aspectRatio: `${width} / ${height}`,
                borderRadius: 3,
                border: '1.5px dashed #C9C7C1',
                bgcolor: '#F7F7F5',
                // Diagonal hatching reads as "deliberately empty" rather than
                // "broken image" at a glance.
                backgroundImage:
                    'repeating-linear-gradient(135deg, transparent, transparent 11px, rgba(58,56,51,0.05) 11px, rgba(58,56,51,0.05) 22px)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.5,
                textAlign: 'center',
                px: 2,
                ...sx
            }}
        >
            <Typography
                sx={{
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    fontSize: { xs: '0.9rem', md: '1.05rem' },
                    fontWeight: 700,
                    color: '#3A3833',
                    letterSpacing: '0.02em'
                }}
            >
                {width} × {height} px
            </Typography>
            {label && (
                <Typography
                    variant="caption"
                    sx={{ color: '#73726E', maxWidth: 320, lineHeight: 1.4 }}
                >
                    {label}
                </Typography>
            )}
        </Box>
    );
}
