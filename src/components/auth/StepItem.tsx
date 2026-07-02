import { Box, Typography } from '@mui/material';

interface StepItemProps {
  index: number;
  title: string;
  description?: string;
}

export default function StepItem({ index, title, description }: StepItemProps) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
      <Box
        sx={{
          width: 32,
          height: 32,
          flexShrink: 0,
          borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography variant="caption" sx={{ color: '#fff', fontWeight: 700 }}>
          {index}
        </Typography>
      </Box>
      <Box>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.92)', fontWeight: 600 }}>
          {title}
        </Typography>
        {description && (
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)' }}>
            {description}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
