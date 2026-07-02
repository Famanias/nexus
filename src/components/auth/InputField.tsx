import { TextField, TextFieldProps } from '@mui/material';

export default function InputField({ sx, ...rest }: TextFieldProps) {
  return <TextField fullWidth sx={{ mb: 2, ...sx }} {...rest} />;
}
