import { Box, Skeleton } from '@mui/material';

export default function KanbanLoading() {
  return (
    <Box sx={{ p: 3, display: 'flex', gap: 2, overflow: 'hidden' }}>
      {[1, 2, 3, 4].map((i) => (
        <Box key={i} sx={{ minWidth: 300 }}>
          <Skeleton variant="rounded" height={48} sx={{ mb: 1, borderRadius: 1 }} />
          <Skeleton variant="rounded" height={100} sx={{ mb: 1, borderRadius: 1 }} />
          <Skeleton variant="rounded" height={100} sx={{ mb: 1, borderRadius: 1 }} />
          <Skeleton variant="rounded" height={100} sx={{ borderRadius: 1 }} />
        </Box>
      ))}
    </Box>
  );
}
