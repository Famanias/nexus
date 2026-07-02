import { useState } from 'react';
import { InputAdornment, IconButton, TextFieldProps } from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import InputField from './InputField';

type PasswordFieldProps = Omit<TextFieldProps, 'type'>;

export default function PasswordField({ InputProps, sx, ...rest }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <InputField
      type={visible ? 'text' : 'password'}
      sx={sx}
      InputProps={{
        ...InputProps,
        endAdornment: (
          <InputAdornment position="end">
            <IconButton
              onClick={() => setVisible((v) => !v)}
              edge="end"
              tabIndex={-1}
              aria-label={visible ? 'Hide password' : 'Show password'}
            >
              {visible ? <VisibilityOff /> : <Visibility />}
            </IconButton>
          </InputAdornment>
        ),
      }}
      {...rest}
    />
  );
}
