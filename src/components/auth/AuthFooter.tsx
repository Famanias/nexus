import { Box, Typography } from '@mui/material';
import Link from 'next/link';

interface AuthFooterProps {
  promptText: string;
  linkText: string;
  href: string;
}

export default function AuthFooter({ promptText, linkText, href }: AuthFooterProps) {
  return (
    <Box sx={{ textAlign: 'center', mt: 3 }}>
      <Typography variant="body2" color="text.secondary">
        {promptText}{' '}
        <Link href={href} style={{ fontWeight: 600, textDecoration: 'none' }}>
          {linkText}
        </Link>
      </Typography>
    </Box>
  );
}
