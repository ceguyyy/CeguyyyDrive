import React from 'react';
import { Box } from '@mui/material';

export default function CloudLogo({ size = 32, sx, ...props }) {
    const width = size;
    const height = Math.round(size * 0.72);

    return (
        <Box
            component="svg"
            viewBox="0 0 120 85"
            width={width}
            height={height}
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            sx={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...sx }}
            {...props}
        >
            <defs>
                <linearGradient id="greyCloudGrad" x1="10" y1="80" x2="100" y2="10" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#374151" />
                    <stop offset="45%" stopColor="#4B5563" />
                    <stop offset="75%" stopColor="#6B7280" />
                    <stop offset="100%" stopColor="#9CA3AF" />
                </linearGradient>
            </defs>

            {/* Solid Smooth Cloud Base (Grey) */}
            <path
                d="M 22 75 H 92 C 103 75 112 66 112 55 C 112 45 104 37 94 36 C 91 23 80 14 66 14 C 57 14 49 18 43 25 C 40 23 35 21 30 21 C 18 21 8 30 8 42 C 8 45 8.8 48 10 51 C 4.5 54 1 60.5 1 67 C 1 72 6 75 13 75 Z"
                fill="url(#greyCloudGrad)"
            />

            {/* Cutout / Dissolving Pixel Matrix on Top-Right Corner */}
            {/* Row 1 (y=14) */}
            <rect x="66" y="14" width="7" height="7" fill="#6B7280" rx="1" />
            <rect x="75" y="14" width="7" height="7" fill="#9CA3AF" rx="1" />
            <rect x="84" y="14" width="7" height="7" fill="#D1D5DB" rx="1" />
            <rect x="93" y="14" width="7" height="7" fill="#E5E7EB" rx="1" opacity="0.8" />
            <rect x="102" y="14" width="6" height="6" fill="#F3F4F6" rx="1" opacity="0.6" />

            {/* Row 2 (y=23) */}
            <rect x="75" y="23" width="7" height="7" fill="#4B5563" rx="1" />
            <rect x="84" y="23" width="7" height="7" fill="#6B7280" rx="1" />
            <rect x="93" y="23" width="7" height="7" fill="#9CA3AF" rx="1" />
            <rect x="102" y="23" width="7" height="7" fill="#D1D5DB" rx="1" opacity="0.75" />

            {/* Row 3 (y=32) */}
            <rect x="84" y="32" width="7" height="7" fill="#4B5563" rx="1" />
            <rect x="93" y="32" width="7" height="7" fill="#6B7280" rx="1" />
            <rect x="102" y="32" width="7" height="7" fill="#9CA3AF" rx="1" opacity="0.8" />
            <rect x="111" y="23" width="6" height="6" fill="#E5E7EB" rx="1" opacity="0.5" />

            {/* Floating Pixel Particles (Upper Right Dispersion) */}
            <rect x="102" y="5" width="5" height="5" fill="#9CA3AF" rx="1" opacity="0.9" />
            <rect x="111" y="12" width="5" height="5" fill="#D1D5DB" rx="1" opacity="0.7" />
            <rect x="118" y="4" width="4" height="4" fill="#E5E7EB" rx="1" opacity="0.5" />
        </Box>
    );
}
