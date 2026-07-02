import { Button, ButtonProps, CircularProgress } from '@mui/material';

interface PrimaryButtonProps extends ButtonProps {
  loading?: boolean;
}

export default function PrimaryButton({ loading, disabled, children, sx, ...rest }: PrimaryButtonProps) {
  return (
    <Button
      type="submit"
      fullWidth
      variant="contained"
      size="large"
      disabled={disabled || loading}
      sx={{ py: 1.5, fontSize: 16, ...sx }}
      {...rest}
    >
      {loading ? <CircularProgress size={24} color="inherit" /> : children}
    </Button>
  );
}
