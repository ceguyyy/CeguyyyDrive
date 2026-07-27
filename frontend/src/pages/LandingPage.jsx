import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
    Box, Container, Typography, Button, Stack, Grid, Divider,
    IconButton, Drawer, List, ListItemButton, ListItemText
} from '@mui/material';
import {
    Menu as MenuIcon,
    ArrowForward as ArrowIcon,
    Apartment as DriveIcon,
    FactCheck as ApprovalIcon,
    Hub as IntegrationIcon,
    ViewKanban as CrmIcon
} from '@mui/icons-material';
import CloudLogo from '../components/ui/CloudLogo';
import Wireframe from '../components/landing/Wireframe';
import { useRevealOnScroll } from '../hooks/useRevealOnScroll';
import { useRotatingWord, useParallax } from '../hooks/useLandingMotion';

// The brand bar from the mark, reused as the page's accent vocabulary so the
// landing and the logo are visibly the same system.
const CHARCOAL = '#3A3833';
const ORANGE = '#F5A210';
const RED = '#EE5458';
const BLUE = '#1B77D2';

const NAV = [
    { label: 'Company Drive', href: '#pillars' },
    { label: 'Platform', href: '#numbers' },
    { label: 'Journey', href: '#journey' },
    { label: 'Updates', href: '#updates' }
];

const PILLARS = [
    {
        icon: <DriveIcon />, accent: BLUE, name: 'Company Drive',
        body: 'Storage that follows your org chart. Every role owns a folder, and quotas cascade from the top down instead of being handed out one person at a time.'
    },
    {
        icon: <ApprovalIcon />, accent: ORANGE, name: 'Approval Workflows',
        body: 'Route a document through the people who must sign it. Every step, comment, revision and signature is recorded and replayable.'
    },
    {
        icon: <IntegrationIcon />, accent: RED, name: 'Integration API',
        body: 'Scoped keys that reach exactly what you grant and nothing else. A key that lists files cannot invite members or approve documents.'
    },
    {
        icon: <CrmIcon />, accent: CHARCOAL, name: 'AbuGreySoft CRM',
        body: 'Boards, groups, timelines and pipelines beside the drive they draw from — not a second system to keep in sync.'
    }
];

const NUMBERS = [
    { value: '6', label: 'Scopes an API key can carry', note: 'Granted individually' },
    { value: '3', label: 'Levels in the default hierarchy', note: 'Owner, Manager, Staff' },
    { value: '1 TB', label: 'Storage on Enterprise', note: 'Per organization' },
    { value: '500', label: 'Members on Enterprise', note: 'Per organization' },
    { value: '15 min', label: 'Password reset window', note: 'Single-use, attempt-capped' },
    { value: '24 h', label: 'Session lifetime', note: 'Revoked on password change' }
];

const JOURNEY = [
    { when: 'Foundation', what: 'Drive, folders, sharing', body: 'Personal and company storage with presigned uploads and link sharing.' },
    { when: 'Organizations', what: 'Roles and approvals', body: 'A drag-and-drop role hierarchy, per-role quotas, and multi-step approval flows.' },
    { when: 'Platform', what: 'Billing and tiers', body: 'Editable subscription tiers, licence keys, and per-organization feature control.' },
    { when: 'Open', what: 'Integration API', body: 'Scoped API keys for the drive, organization, and approval surfaces.' },
    { when: 'Next', what: 'CRM and reporting', body: 'Boards and records, then analytics built on top of them.' }
];

// The surfaces the platform covers, cycled through the headline so the sentence
// states the breadth without listing it.
const ROTATING = ['CRM', 'DMS', 'Integration', 'Approvals', 'Organization', 'Company Drive'];

const UPDATES = [
    { date: 'Latest', title: 'Hierarchy-governed member suspension', body: 'A Manager can suspend a Staff member. Nobody can suspend upward.' },
    { date: 'Latest', title: 'Scoped integration keys', body: 'Six scopes, hashed at rest, shown once and never again.' },
    { date: 'Latest', title: 'Editable subscription tiers', body: 'Quotas and features are data now, not four copies in the source.' }
];

/** A section that fades and lifts once, the first time it enters the viewport. */
function Reveal({ children, sx }) {
    const { ref, revealSx } = useRevealOnScroll();
    return <Box ref={ref} sx={{ ...revealSx, ...sx }}>{children}</Box>;
}

function SectionLabel({ children, light = false }) {
    return (
        <Typography
            sx={{
                fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.18em',
                textTransform: 'uppercase', color: light ? 'rgba(255,255,255,0.55)' : '#8A8880',
                mb: 2
            }}
        >
            {children}
        </Typography>
    );
}

export default function LandingPage() {
    const [navOpen, setNavOpen] = useState(false);
    const rotating = useRotatingWord(ROTATING);
    const heroArt = useParallax(0.09);
    const quoteArt = useParallax(0.06);

    return (
        <Box sx={{ bgcolor: '#FFFFFF', color: '#37352F', overflowX: 'hidden' }}>
            {/* ── Header ─────────────────────────────────────────────────── */}
            <Box
                component="header"
                sx={{
                    position: 'sticky', top: 0, zIndex: 20,
                    bgcolor: 'rgba(58,56,51,0.92)', backdropFilter: 'blur(10px)',
                    borderBottom: '1px solid rgba(255,255,255,0.08)'
                }}
            >
                {/* The mark's bar, laid flat across the top. It ties the nav to the
                    logo and gives the bar an edge instead of ending in flat grey. */}
                <Stack direction="row" sx={{ height: 3 }}>
                    <Box sx={{ flex: 1, bgcolor: ORANGE }} />
                    <Box sx={{ flex: 1, bgcolor: RED }} />
                    <Box sx={{ flex: 1, bgcolor: BLUE }} />
                </Stack>

                <Container maxWidth="lg">
                    {/* minHeight, not height: the row may never be shorter than the
                        bar, but it must be free to grow rather than let a child
                        overflow it and drag the alignment off. */}
                    <Stack direction="row" alignItems="center" sx={{ minHeight: 76, gap: 2 }}>
                        <Stack direction="row" alignItems="center" spacing={1.25} sx={{ flexShrink: 0 }}>
                            <CloudLogo size={30} />
                            {/* A flex column with its own centring: two stacked lines
                                otherwise sit wherever Typography's inherited
                                line-height puts them, which is not the optical middle. */}
                            <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '0.95rem', lineHeight: 1.15, letterSpacing: '-0.01em' }}>
                                    AbuGreySoft
                                </Typography>
                                <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.68rem', lineHeight: 1.15, letterSpacing: '0.08em' }}>
                                    BOX
                                </Typography>
                            </Box>
                        </Stack>

                        {/* Without alignItems the default is stretch, so each anchor
                            grew to the full bar height and its text sat against the
                            top of its own padding. That was the misalignment. */}
                        <Stack direction="row" spacing={3} alignItems="center" sx={{ ml: 4, flex: 1, display: { xs: 'none', md: 'flex' } }}>
                            {NAV.map(item => (
                                <Box
                                    key={item.href}
                                    component="a"
                                    href={item.href}
                                    sx={{
                                        display: 'flex', alignItems: 'center',
                                        color: 'rgba(255,255,255,0.72)', textDecoration: 'none',
                                        fontSize: '0.86rem', fontWeight: 500,
                                        height: 34, lineHeight: 1,
                                        borderBottom: '2px solid transparent',
                                        transition: 'color 160ms ease, border-color 160ms ease',
                                        '&:hover': { color: '#fff', borderBottomColor: ORANGE }
                                    }}
                                >
                                    {item.label}
                                </Box>
                            ))}
                        </Stack>

                        <Box sx={{ flex: { xs: 1, md: 0 } }} />

                        {/* Both buttons share one height so they sit on a common
                            baseline. Left to their own padding they differ, which is
                            what made the filled one look dropped out of the bar. */}
                        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ display: { xs: 'none', sm: 'flex' } }}>
                            <Button
                                component={RouterLink} to="/login" disableElevation
                                sx={{
                                    height: 38, px: 2, borderRadius: 2, lineHeight: 1,
                                    color: 'rgba(255,255,255,0.85)', textTransform: 'none', fontWeight: 600,
                                    '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.08)' }
                                }}
                            >
                                Sign In
                            </Button>
                            <Button
                                component={RouterLink} to="/register" variant="contained" disableElevation
                                sx={{
                                    height: 38, px: 2.25, borderRadius: 2, lineHeight: 1,
                                    bgcolor: '#fff', color: CHARCOAL, textTransform: 'none', fontWeight: 700,
                                    boxShadow: 'none',
                                    '&:hover': { bgcolor: '#EFEFED', boxShadow: 'none' }
                                }}
                            >
                                Create Account
                            </Button>
                        </Stack>

                        <IconButton
                            onClick={() => setNavOpen(true)}
                            sx={{ display: { md: 'none' }, color: '#fff' }}
                            aria-label="Open navigation"
                        >
                            <MenuIcon />
                        </IconButton>
                    </Stack>
                </Container>
            </Box>

            <Drawer anchor="right" open={navOpen} onClose={() => setNavOpen(false)}>
                <Box sx={{ width: 260, pt: 2 }} role="presentation" onClick={() => setNavOpen(false)}>
                    <List>
                        {NAV.map(item => (
                            <ListItemButton key={item.href} component="a" href={item.href}>
                                <ListItemText primary={item.label} />
                            </ListItemButton>
                        ))}
                        <Divider sx={{ my: 1 }} />
                        <ListItemButton component={RouterLink} to="/login">
                            <ListItemText primary="Sign In" />
                        </ListItemButton>
                        <ListItemButton component={RouterLink} to="/register">
                            <ListItemText primary="Create Account" primaryTypographyProps={{ fontWeight: 700 }} />
                        </ListItemButton>
                    </List>
                </Box>
            </Drawer>

            {/* ── Hero ───────────────────────────────────────────────────── */}
            <Box sx={{ bgcolor: CHARCOAL, color: '#fff', position: 'relative' }}>
                {/* The brand bar, run down the right edge the way it sits in the mark. */}
                <Box sx={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: { xs: 6, md: 14 }, display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ flex: 1, bgcolor: ORANGE }} />
                    <Box sx={{ flex: 1, bgcolor: RED }} />
                    <Box sx={{ flex: 1, bgcolor: BLUE }} />
                </Box>

                <Container maxWidth="lg" sx={{ py: { xs: 8, md: 14 } }}>
                    <Grid container spacing={{ xs: 5, md: 8 }} alignItems="center">
                        <Grid size={{ xs: 12, md: 6 }}>
                            <Reveal>
                                <SectionLabel light>Enterprise Document Platform</SectionLabel>
                                <Typography
                                    component="h1"
                                    sx={{
                                        fontWeight: 800,
                                        fontSize: { xs: '2.4rem', sm: '3.2rem', md: '3.9rem' },
                                        lineHeight: 1.04,
                                        letterSpacing: '-0.03em',
                                        mb: 3
                                    }}
                                >
                                    Your{' '}
                                    {/* min-width reserves room for the longest word, so
                                        the line does not reflow on every swap. */}
                                    <Box
                                        component="span"
                                        aria-live="polite"
                                        sx={{ ...rotating.fadeSx, color: ORANGE, minWidth: { md: '5.6em' } }}
                                    >
                                        {rotating.word}
                                    </Box>
                                    ,
                                    <Box component="span" sx={{ display: 'block', color: 'rgba(255,255,255,0.55)' }}>
                                        governed by your org chart.
                                    </Box>
                                </Typography>
                                <Typography sx={{ fontSize: { xs: '1rem', md: '1.1rem' }, color: 'rgba(255,255,255,0.7)', lineHeight: 1.65, maxWidth: 520, mb: 4 }}>
                                    Storage, approvals, and an integration API that all read the same role
                                    hierarchy. Grant access once, at the level it belongs, and every surface
                                    honours it.
                                </Typography>
                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                                    <Button
                                        component={RouterLink} to="/register" size="large" variant="contained"
                                        endIcon={<ArrowIcon />}
                                        sx={{
                                            bgcolor: '#fff', color: CHARCOAL, textTransform: 'none',
                                            fontWeight: 700, borderRadius: 2, px: 3, py: 1.4, boxShadow: 'none',
                                            '&:hover': { bgcolor: '#EFEFED', boxShadow: 'none' }
                                        }}
                                    >
                                        Create Account
                                    </Button>
                                    <Button
                                        component={RouterLink} to="/login" size="large"
                                        sx={{
                                            color: '#fff', textTransform: 'none', fontWeight: 600,
                                            borderRadius: 2, px: 3, py: 1.4,
                                            border: '1px solid rgba(255,255,255,0.28)',
                                            '&:hover': { bgcolor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.5)' }
                                        }}
                                    >
                                        Sign In
                                    </Button>
                                </Stack>
                            </Reveal>
                        </Grid>

                        <Grid size={{ xs: 12, md: 6 }}>
                            <Reveal>
                                <Box ref={heroArt.ref} sx={heroArt.parallaxSx}>
                                <Wireframe
                                    width={880} height={620}
                                    label="Hero — product screenshot or illustration"
                                    sx={{ bgcolor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.25)',
                                        backgroundImage: 'repeating-linear-gradient(135deg, transparent, transparent 11px, rgba(255,255,255,0.06) 11px, rgba(255,255,255,0.06) 22px)',
                                        '& p, & span': { color: 'rgba(255,255,255,0.85) !important' } }}
                                />
                                </Box>
                            </Reveal>
                        </Grid>
                    </Grid>
                </Container>
            </Box>

            {/* ── About ──────────────────────────────────────────────────── */}
            <Container maxWidth="md" sx={{ py: { xs: 8, md: 13 } }}>
                <Reveal>
                    <SectionLabel>About</SectionLabel>
                    <Typography
                        sx={{
                            fontSize: { xs: '1.35rem', md: '1.9rem' }, fontWeight: 600,
                            lineHeight: 1.45, letterSpacing: '-0.02em', mb: 3
                        }}
                    >
                        Most document tools ask you to rebuild your company inside them. AbuGreySoft Box
                        reads the structure you already have.
                    </Typography>
                    <Typography sx={{ fontSize: '1.02rem', color: '#5F5E59', lineHeight: 1.75 }}>
                        One role hierarchy governs storage quotas, who may invite whom, which documents
                        route to which approver, and what an API key can reach. Change someone&apos;s role
                        and every surface follows in the same moment — there is no second place to keep
                        in sync, and no way for the two to disagree.
                    </Typography>
                </Reveal>
            </Container>

            {/* ── Pillars ────────────────────────────────────────────────── */}
            <Box id="pillars" sx={{ bgcolor: '#FAFAF9', borderTop: '1px solid #EAEAEA', borderBottom: '1px solid #EAEAEA' }}>
                <Container maxWidth="lg" sx={{ py: { xs: 8, md: 13 } }}>
                    <Reveal>
                        <SectionLabel>Scope of work</SectionLabel>
                        <Typography sx={{ fontWeight: 800, fontSize: { xs: '1.9rem', md: '2.5rem' }, letterSpacing: '-0.025em', mb: { xs: 4, md: 7 }, maxWidth: 640 }}>
                            Four surfaces, one set of rules
                        </Typography>
                    </Reveal>

                    <Grid container spacing={{ xs: 3, md: 4 }}>
                        {PILLARS.map((p) => (
                            <Grid size={{ xs: 12, sm: 6 }} key={p.name}>
                                <Reveal>
                                    <Box
                                        sx={{
                                            height: '100%', bgcolor: '#fff', borderRadius: 3,
                                            border: '1px solid #EAEAEA', overflow: 'hidden',
                                            transition: 'transform 260ms cubic-bezier(0.16,1,0.3,1), box-shadow 260ms ease',
                                            '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 14px 34px rgba(55,53,47,0.09)' }
                                        }}
                                    >
                                        <Box sx={{ height: 5, bgcolor: p.accent }} />
                                        <Box sx={{ p: { xs: 2.5, md: 3.5 } }}>
                                            <Wireframe
                                                width={640} height={320}
                                                label={`${p.name} — section artwork`}
                                                sx={{ mb: 3 }}
                                            />
                                            <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1.25 }}>
                                                <Box sx={{ color: p.accent, display: 'flex' }}>{p.icon}</Box>
                                                <Typography sx={{ fontWeight: 800, fontSize: '1.15rem', letterSpacing: '-0.015em' }}>
                                                    {p.name}
                                                </Typography>
                                            </Stack>
                                            <Typography sx={{ color: '#5F5E59', lineHeight: 1.7, fontSize: '0.95rem' }}>
                                                {p.body}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </Reveal>
                            </Grid>
                        ))}
                    </Grid>
                </Container>
            </Box>

            {/* ── Numbers ────────────────────────────────────────────────── */}
            <Box id="numbers" sx={{ bgcolor: CHARCOAL, color: '#fff' }}>
                <Container maxWidth="lg" sx={{ py: { xs: 8, md: 13 } }}>
                    <Reveal>
                        <SectionLabel light>By the numbers</SectionLabel>
                        <Typography sx={{ fontWeight: 800, fontSize: { xs: '1.9rem', md: '2.5rem' }, letterSpacing: '-0.025em', mb: { xs: 4, md: 7 }, maxWidth: 640 }}>
                            What the platform actually enforces
                        </Typography>
                    </Reveal>

                    <Grid container spacing={0}>
                        {NUMBERS.map((n, i) => (
                            <Grid size={{ xs: 6, md: 4 }} key={n.label}>
                                <Reveal>
                                    <Box
                                        sx={{
                                            p: { xs: 2.5, md: 4 },
                                            borderTop: '1px solid rgba(255,255,255,0.12)',
                                            borderRight: { md: (i + 1) % 3 === 0 ? 'none' : '1px solid rgba(255,255,255,0.12)' },
                                            height: '100%'
                                        }}
                                    >
                                        <Typography sx={{ fontWeight: 800, fontSize: { xs: '2rem', md: '2.9rem' }, letterSpacing: '-0.03em', lineHeight: 1, mb: 1 }}>
                                            {n.value}
                                        </Typography>
                                        <Typography sx={{ fontSize: '0.92rem', fontWeight: 600, mb: 0.5 }}>
                                            {n.label}
                                        </Typography>
                                        <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>
                                            {n.note}
                                        </Typography>
                                    </Box>
                                </Reveal>
                            </Grid>
                        ))}
                    </Grid>
                </Container>
            </Box>

            {/* ── Journey ────────────────────────────────────────────────── */}
            <Container id="journey" maxWidth="lg" sx={{ py: { xs: 8, md: 13 } }}>
                <Reveal>
                    <SectionLabel>Journey</SectionLabel>
                    <Typography sx={{ fontWeight: 800, fontSize: { xs: '1.9rem', md: '2.5rem' }, letterSpacing: '-0.025em', mb: { xs: 4, md: 7 } }}>
                        How it was built
                    </Typography>
                </Reveal>

                <Box sx={{ position: 'relative', pl: { xs: 3, md: 0 } }}>
                    {/* The spine. Hidden on mobile, where the dots carry it alone. */}
                    <Box
                        sx={{
                            position: 'absolute', left: { xs: 5, md: '50%' }, top: 8, bottom: 8, width: 2,
                            bgcolor: '#EAEAEA', transform: { md: 'translateX(-1px)' }
                        }}
                    />
                    {JOURNEY.map((step, i) => {
                        const onLeft = i % 2 === 0;
                        return (
                            <Reveal key={step.what}>
                                <Box sx={{ position: 'relative', mb: { xs: 4, md: 6 } }}>
                                    <Box
                                        sx={{
                                            position: 'absolute', left: { xs: -19, md: '50%' }, top: 6,
                                            width: 12, height: 12, borderRadius: '50%',
                                            bgcolor: i === JOURNEY.length - 1 ? ORANGE : CHARCOAL,
                                            border: '2px solid #fff', boxShadow: '0 0 0 3px #EAEAEA',
                                            transform: { md: 'translateX(-6px)' }, zIndex: 1
                                        }}
                                    />
                                    <Box
                                        sx={{
                                            width: { md: '46%' },
                                            ml: { md: onLeft ? 0 : '54%' },
                                            textAlign: { md: onLeft ? 'right' : 'left' }
                                        }}
                                    >
                                        <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: ORANGE, mb: 0.75 }}>
                                            {step.when}
                                        </Typography>
                                        <Typography sx={{ fontWeight: 700, fontSize: '1.15rem', mb: 0.75, letterSpacing: '-0.015em' }}>
                                            {step.what}
                                        </Typography>
                                        <Typography sx={{ color: '#5F5E59', lineHeight: 1.7, fontSize: '0.95rem' }}>
                                            {step.body}
                                        </Typography>
                                    </Box>
                                </Box>
                            </Reveal>
                        );
                    })}
                </Box>
            </Container>

            {/* ── Quote ──────────────────────────────────────────────────── */}
            <Box sx={{ bgcolor: '#FAFAF9', borderTop: '1px solid #EAEAEA', borderBottom: '1px solid #EAEAEA' }}>
                <Container maxWidth="lg" sx={{ py: { xs: 8, md: 13 } }}>
                    <Grid container spacing={{ xs: 4, md: 8 }} alignItems="center">
                        <Grid size={{ xs: 12, md: 4 }}>
                            <Reveal>
                                <Box ref={quoteArt.ref} sx={quoteArt.parallaxSx}>
                                    <Wireframe width={480} height={560} label="Portrait — leadership photo" />
                                </Box>
                            </Reveal>
                        </Grid>
                        <Grid size={{ xs: 12, md: 8 }}>
                            <Reveal>
                                <Typography
                                    component="blockquote"
                                    sx={{
                                        m: 0, fontWeight: 600, letterSpacing: '-0.02em',
                                        fontSize: { xs: '1.35rem', md: '2rem' }, lineHeight: 1.45, mb: 3
                                    }}
                                >
                                    “Access should be a consequence of someone&apos;s position, not a
                                    checkbox somebody remembered to tick.”
                                </Typography>
                                <Divider sx={{ width: 56, borderBottomWidth: 3, borderColor: ORANGE, mb: 2 }} />
                                <Typography sx={{ fontWeight: 700 }}>AbuGreySoft</Typography>
                                <Typography sx={{ color: '#73726E', fontSize: '0.9rem' }}>
                                    Design principle behind the role hierarchy
                                </Typography>
                            </Reveal>
                        </Grid>
                    </Grid>
                </Container>
            </Box>

            {/* ── Updates ────────────────────────────────────────────────── */}
            <Container id="updates" maxWidth="lg" sx={{ py: { xs: 8, md: 13 } }}>
                <Reveal>
                    <SectionLabel>Updates</SectionLabel>
                    <Typography sx={{ fontWeight: 800, fontSize: { xs: '1.9rem', md: '2.5rem' }, letterSpacing: '-0.025em', mb: { xs: 4, md: 7 } }}>
                        Recently shipped
                    </Typography>
                </Reveal>

                <Grid container spacing={{ xs: 3, md: 4 }}>
                    {UPDATES.map(u => (
                        <Grid size={{ xs: 12, md: 4 }} key={u.title}>
                            <Reveal>
                                <Box
                                    sx={{
                                        height: '100%', borderRadius: 3, border: '1px solid #EAEAEA',
                                        overflow: 'hidden', bgcolor: '#fff',
                                        transition: 'transform 260ms cubic-bezier(0.16,1,0.3,1), box-shadow 260ms ease',
                                        '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 14px 34px rgba(55,53,47,0.09)' }
                                    }}
                                >
                                    <Wireframe width={560} height={315} label="Update thumbnail" sx={{ borderRadius: 0, border: 'none', borderBottom: '1px solid #EAEAEA' }} />
                                    <Box sx={{ p: 3 }}>
                                        <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#8A8880', mb: 1 }}>
                                            {u.date}
                                        </Typography>
                                        <Typography sx={{ fontWeight: 700, fontSize: '1.05rem', mb: 1, letterSpacing: '-0.015em' }}>
                                            {u.title}
                                        </Typography>
                                        <Typography sx={{ color: '#5F5E59', lineHeight: 1.7, fontSize: '0.93rem' }}>
                                            {u.body}
                                        </Typography>
                                    </Box>
                                </Box>
                            </Reveal>
                        </Grid>
                    ))}
                </Grid>
            </Container>

            {/* ── Closing call to action ─────────────────────────────────── */}
            <Box sx={{ bgcolor: CHARCOAL, color: '#fff' }}>
                <Container maxWidth="md" sx={{ py: { xs: 8, md: 12 }, textAlign: 'center' }}>
                    <Reveal>
                        <Typography sx={{ fontWeight: 800, fontSize: { xs: '2rem', md: '2.8rem' }, letterSpacing: '-0.03em', mb: 2 }}>
                            Start with your first workspace
                        </Typography>
                        <Typography sx={{ color: 'rgba(255,255,255,0.65)', fontSize: '1.05rem', mb: 4, maxWidth: 520, mx: 'auto', lineHeight: 1.7 }}>
                            Creating an organization needs a licence key. Already have one, or been invited
                            by a colleague? Both start in the same place.
                        </Typography>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="center">
                            <Button
                                component={RouterLink} to="/register" size="large" variant="contained" endIcon={<ArrowIcon />}
                                sx={{
                                    bgcolor: '#fff', color: CHARCOAL, textTransform: 'none', fontWeight: 700,
                                    borderRadius: 2, px: 3, py: 1.4, boxShadow: 'none',
                                    '&:hover': { bgcolor: '#EFEFED', boxShadow: 'none' }
                                }}
                            >
                                Create Account
                            </Button>
                            <Button
                                component={RouterLink} to="/login" size="large"
                                sx={{
                                    color: '#fff', textTransform: 'none', fontWeight: 600, borderRadius: 2, px: 3, py: 1.4,
                                    border: '1px solid rgba(255,255,255,0.28)',
                                    '&:hover': { bgcolor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.5)' }
                                }}
                            >
                                Sign In
                            </Button>
                        </Stack>
                    </Reveal>
                </Container>
            </Box>

            {/* ── Footer ─────────────────────────────────────────────────── */}
            <Box component="footer" sx={{ bgcolor: '#26251F', color: 'rgba(255,255,255,0.65)' }}>
                <Container maxWidth="lg" sx={{ py: { xs: 5, md: 7 } }}>
                    <Grid container spacing={4}>
                        <Grid size={{ xs: 12, md: 5 }}>
                            <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 1.5 }}>
                                <CloudLogo size={28} />
                                <Typography sx={{ color: '#fff', fontWeight: 800 }}>AbuGreySoft Box</Typography>
                            </Stack>
                            <Typography sx={{ fontSize: '0.88rem', lineHeight: 1.7, maxWidth: 320 }}>
                                Enterprise document storage, approvals, and integration — governed by one
                                role hierarchy.
                            </Typography>
                        </Grid>

                        <Grid size={{ xs: 6, md: 3 }}>
                            <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.85rem', mb: 1.5 }}>Product</Typography>
                            <Stack spacing={1}>
                                {NAV.map(item => (
                                    <Box key={item.href} component="a" href={item.href}
                                        sx={{ color: 'inherit', textDecoration: 'none', fontSize: '0.88rem', '&:hover': { color: '#fff' } }}>
                                        {item.label}
                                    </Box>
                                ))}
                            </Stack>
                        </Grid>

                        <Grid size={{ xs: 6, md: 4 }}>
                            <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.85rem', mb: 1.5 }}>Account</Typography>
                            <Stack spacing={1}>
                                <Box component={RouterLink} to="/login" sx={{ color: 'inherit', textDecoration: 'none', fontSize: '0.88rem', '&:hover': { color: '#fff' } }}>
                                    Sign In
                                </Box>
                                <Box component={RouterLink} to="/register" sx={{ color: 'inherit', textDecoration: 'none', fontSize: '0.88rem', '&:hover': { color: '#fff' } }}>
                                    Create Account
                                </Box>
                                <Box component={RouterLink} to="/forgot-password" sx={{ color: 'inherit', textDecoration: 'none', fontSize: '0.88rem', '&:hover': { color: '#fff' } }}>
                                    Forgot Password
                                </Box>
                            </Stack>
                        </Grid>
                    </Grid>

                    <Divider sx={{ my: 4, borderColor: 'rgba(255,255,255,0.1)' }} />

                    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
                        <Typography sx={{ fontSize: '0.8rem' }}>
                            © {new Date().getFullYear()} AbuGreySoft. All rights reserved.
                        </Typography>
                        <Stack direction="row" spacing={0.5}>
                            <Box sx={{ width: 26, height: 5, bgcolor: ORANGE, borderRadius: 1 }} />
                            <Box sx={{ width: 26, height: 5, bgcolor: RED, borderRadius: 1 }} />
                            <Box sx={{ width: 26, height: 5, bgcolor: BLUE, borderRadius: 1 }} />
                        </Stack>
                    </Stack>
                </Container>
            </Box>
        </Box>
    );
}
