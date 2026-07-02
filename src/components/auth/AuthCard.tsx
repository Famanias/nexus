import { Box, Card, CardContent, Typography } from '@mui/material';

interface AuthCardProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

export default function AuthCard({ title, subtitle, children }: AuthCardProps) {
  return (
    <Box sx={{ width: '100%', maxWidth: 600 }}>
      <Card sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: { xs: 3, sm: 6 } }}>
          <Typography variant="h4" fontWeight={700} sx={{ mb: 0.5, letterSpacing: '-0.02em' }}>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
            {subtitle}
          </Typography>
          {children}
        </CardContent>
      </Card>
    </Box>
  );
}
