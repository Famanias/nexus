import { Box, Skeleton } from '@mui/material';

export default function SettingsLoading() {
  return (
    <Box sx={{ p: 3, maxWidth: 800 }}>
      <Skeleton variant="text" width={220} height={40} sx={{ mb: 0.5 }} />
      <Skeleton variant="text" width={300} height={24} sx={{ mb: 3 }} />
      <Skeleton variant="rounded" height={300} sx={{ mb: 3, borderRadius: 1 }} />
      <Skeleton variant="rounded" height={200} sx={{ mb: 3, borderRadius: 1 }} />
      <Skeleton variant="rounded" width={160} height={44} sx={{ borderRadius: 1 }} />
    </Box>
  );
}
