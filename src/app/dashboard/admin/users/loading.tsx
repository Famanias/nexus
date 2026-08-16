import { Box, Skeleton } from '@mui/material';

export default function AdminLoading() {
  return (
    <Box sx={{ p: 3, width: '100%' }}>
      <Skeleton variant="text" width={260} height={40} sx={{ mb: 0.5 }} />
      <Skeleton variant="text" width={180} height={24} sx={{ mb: 3 }} />
      <Skeleton variant="rounded" height={56} sx={{ mb: 2, borderRadius: 1 }} />
      <Skeleton variant="rounded" height={400} sx={{ borderRadius: 1 }} />
    </Box>
  );
}
