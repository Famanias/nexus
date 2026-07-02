import { Box, Typography, Stack } from '@mui/material';
import StepItem from './StepItem';

const STEPS = [
  { title: 'Create your account' },
  { title: 'Complete your profile' },
  { title: 'Access your dashboard' },
];

export default function HeroPanel() {
  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        bgcolor: '#0a0a0a',
        color: '#fff',
        px: { md: 6, lg: 8 },
        py: 8,
        overflow: 'hidden',
      }}
    >
      {/* Decorative background — placeholder, swap for the site's cosmic/node
          background treatment once colors/animation are finalized */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.06), transparent 45%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.04), transparent 40%)',
        }}
      />

      {/* Logo */}
      <Box sx={{ position: 'relative', zIndex: 1 }}>
        <Typography
          component="span"
          sx={{ fontFamily: 'Blanka, sans-serif', fontSize: '1.5rem', letterSpacing: '.04em' }}
        >
          Nexus
        </Typography>
      </Box>

      {/* Headline + description */}
      <Box sx={{ position: 'relative', zIndex: 1, maxWidth: 440 }}>
        <Typography variant="h3" fontWeight={700} sx={{ mb: 2, letterSpacing: '-0.02em' }}>
          One workspace for every internship.
        </Typography>
        <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7 }}>
          Nexus helps students, companies, and coordinators manage internship
          workflows in one place — from onboarding to sign-off.
        </Typography>
      </Box>

      {/* Onboarding steps */}
      <Stack spacing={2.5} sx={{ position: 'relative', zIndex: 1 }}>
        {STEPS.map((step, i) => (
          <StepItem key={step.title} index={i + 1} title={step.title} />
        ))}
      </Stack>
    </Box>
  );
}
