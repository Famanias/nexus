import { Box, Typography } from '@mui/material';

interface AuthDividerProps {
  label: string;
}

export default function AuthDivider({ label }: AuthDividerProps) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, my: 3 }}>
      <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
      <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
        {label}
      </Typography>
      <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
    </Box>
  );
}
