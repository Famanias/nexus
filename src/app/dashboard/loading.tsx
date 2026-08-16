import { Box, Skeleton, Grid } from '@mui/material';

export default function DashboardLoading() {
  return (
    <Box sx={{ p: 3, width: '100%' }}>
      <Skeleton variant="text" width={280} height={40} sx={{ mb: 0.5 }} />
      <Skeleton variant="text" width={200} height={24} sx={{ mb: 3 }} />
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[1, 2, 3, 4].map((i) => (
          <Grid size={{ xs: 12, sm: 6, lg: 3 }} key={i}>
            <Skeleton variant="rounded" height={120} sx={{ borderRadius: 1 }} />
          </Grid>
        ))}
      </Grid>
      <Skeleton variant="rounded" height={400} sx={{ borderRadius: 1 }} />
    </Box>
  );
}
