import { Suspense } from 'react';
import LoginForm from '@/components/auth/LoginForm';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingSpinner fullPage message="Loading Login..." />}>
      <LoginForm />
    </Suspense>
  );
}
