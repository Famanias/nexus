import { Box } from '@mui/material';
import HeroPanel from './HeroPanel';

interface AuthPageShellProps {
  children: React.ReactNode;
}

export default function AuthPageShell({ children }: AuthPageShellProps) {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex' }}>
      {/* Left — branding panel, hidden below md */}
      <Box sx={{ display: { xs: 'none', md: 'block' }, width: { md: '52%' } }}>
        <HeroPanel />
      </Box>

      {/* Right — auth form, centered */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: { xs: 3, sm: 6 },
          py: 6,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
