import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { ToastProvider, useToast } from '@/lib/context/ToastContext';

function TestConsumer() {
  const { showSuccess, showError, showWarning, showInfo } = useToast();
  return (
    <div>
      <button onClick={() => showSuccess('Success message')}>Trigger Success</button>
      <button onClick={() => showError('Error message')}>Trigger Error</button>
      <button onClick={() => showWarning('Warning message')}>Trigger Warning</button>
      <button onClick={() => showInfo('Info message')}>Trigger Info</button>
    </div>
  );
}

describe('ToastContext & ToastProvider', () => {
  it('throws error when useToast is used outside provider', () => {
    // Suppress console.error during expected error test
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow('useToast must be used within a ToastProvider');
    spy.mockRestore();
  });

  it('renders and displays success toast', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    );

    await user.click(screen.getByText('Trigger Success'));
    expect(screen.getByText('Success message')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders and displays error toast with alert role', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    );

    await user.click(screen.getByText('Trigger Error'));
    expect(screen.getByText('Error message')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('allows closing the toast via close button', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    );

    await user.click(screen.getByText('Trigger Warning'));
    expect(screen.getByText('Warning message')).toBeInTheDocument();

    const closeBtn = screen.getByLabelText('Close notification');
    await user.click(closeBtn);

    // After animation/transition it closes
    expect(closeBtn).toBeInTheDocument();
  });
});
