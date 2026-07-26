import { Box } from '@mui/material';

/**
 * The AbuGreySoft mark: a charcoal field carrying a light rosette, with the
 * brand's orange / red / blue bar down the right edge.
 *
 * Drawn as inline SVG rather than shipped as an image so it stays crisp at
 * every size, needs no network request, and inherits no background.
 *
 * The name is kept for now: it is imported in eight places, and renaming the
 * file is a separate change from rebranding what it draws.
 */
export default function CloudLogo({ size = 32, sx, ...props }) {
    // The mark is square, unlike the cloud it replaces, which was 120x85.
    return (
        <Box
            component="svg"
            viewBox="0 0 360 360"
            width={size}
            height={size}
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-label="AbuGreySoft"
            sx={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...sx }}
            {...props}
        >
            {/* Charcoal field */}
            <rect x="0" y="0" width="240" height="360" fill="#3A3833" />

            {/* Brand bar */}
            <rect x="240" y="0" width="120" height="120" fill="#F5A210" />
            <rect x="240" y="120" width="120" height="120" fill="#EE5458" />
            <rect x="240" y="240" width="120" height="120" fill="#1B77D2" />

            {/* Rosette: six petals around a centre, unioned into one shape so the
                overlaps do not show as seams at small sizes. */}
            <g fill="#D9D9D9">
                <circle cx="122" cy="180" r="52" />
                <circle cx="122" cy="128" r="40" />
                <circle cx="167" cy="154" r="40" />
                <circle cx="167" cy="206" r="40" />
                <circle cx="122" cy="232" r="40" />
                <circle cx="77" cy="206" r="40" />
                <circle cx="77" cy="154" r="40" />
            </g>

            {/* The charcoal shows through the centre as an octagon. */}
            <polygon
                points="116,167 128,167 135,174 135,186 128,193 116,193 109,186 109,174"
                fill="#3A3833"
            />
        </Box>
    );
}
