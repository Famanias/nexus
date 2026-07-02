import { Button, ButtonProps } from '@mui/material';

interface SocialButtonProps extends Omit<ButtonProps, 'variant' | 'size'> {
  icon: React.ReactNode;
}

/**
 * Generic social-auth button. Add more providers by rendering another
 * <SocialButton icon={<GitHubIcon />}>Continue with GitHub</SocialButton>
 * alongside this one — the component makes no assumption about provider count.
 */
export default function SocialButton({ icon, children, sx, ...rest }: SocialButtonProps) {
  return (
    <Button
      fullWidth
      variant="outlined"
      size="large"
      startIcon={icon}
      sx={{ justifyContent: 'center', py: 1.25, textTransform: 'none', fontWeight: 600, ...sx }}
      {...rest}
    >
      {children}
    </Button>
  );
}
