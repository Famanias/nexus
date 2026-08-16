'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Snackbar, Alert, AlertColor, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

export interface ToastOptions {
  message: string;
  severity?: AlertColor;
  duration?: number;
}

export interface ToastContextType {
  showToast: (options: ToastOptions) => void;
  showSuccess: (message: string, duration?: number) => void;
  showError: (message: string, duration?: number) => void;
  showWarning: (message: string, duration?: number) => void;
  showInfo: (message: string, duration?: number) => void;
  hideToast: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<AlertColor>('info');
  const [duration, setDuration] = useState(5000);

  const showToast = useCallback(({ message, severity = 'info', duration = 5000 }: ToastOptions) => {
    setMessage(message);
    setSeverity(severity);
    setDuration(duration);
    setOpen(true);
  }, []);

  const showSuccess = useCallback((message: string, duration = 5000) => {
    showToast({ message, severity: 'success', duration });
  }, [showToast]);

  const showError = useCallback((message: string, duration = 6000) => {
    showToast({ message, severity: 'error', duration });
  }, [showToast]);

  const showWarning = useCallback((message: string, duration = 5000) => {
    showToast({ message, severity: 'warning', duration });
  }, [showToast]);

  const showInfo = useCallback((message: string, duration = 5000) => {
    showToast({ message, severity: 'info', duration });
  }, [showToast]);

  const hideToast = useCallback(() => {
    setOpen(false);
  }, []);

  const handleClose = (event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') return;
    setOpen(false);
  };

  return (
    <ToastContext.Provider
      value={{
        showToast,
        showSuccess,
        showError,
        showWarning,
        showInfo,
        hideToast,
      }}
    >
      {children}
      <Snackbar
        open={open}
        autoHideDuration={duration}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        sx={{ mb: { xs: 2, sm: 3 }, mr: { xs: 2, sm: 3 }, zIndex: 1400 }}
      >
        <Alert
          onClose={handleClose}
          severity={severity}
          variant="filled"
          elevation={6}
          role={severity === 'error' ? 'alert' : 'status'}
          aria-live="polite"
          sx={{
            minWidth: 280,
            maxWidth: 480,
            borderRadius: 2,
            fontWeight: 500,
            alignItems: 'center',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
            '& .MuiAlert-icon': {
              fontSize: '1.25rem',
            },
          }}
          action={
            <IconButton
              size="small"
              aria-label="Close notification"
              color="inherit"
              onClick={handleClose}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          }
        >
          {message}
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
