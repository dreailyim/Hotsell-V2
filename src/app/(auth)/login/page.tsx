
import { Suspense } from 'react';
import LoginForm from './login-form';
import { Logo } from '@/components/logo';

// This is the new root page for /login.
// It wraps the actual form logic in a Suspense boundary as required by Next.js
// when using hooks like `useSearchParams`.
export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <LoginForm />
    </Suspense>
  );
}

function LoadingFallback() {
    return (
        <div className="flex h-screen items-center justify-center">
            <div className="flex flex-col items-center justify-center gap-4">
                <Logo className="h-16 w-16" />
                <p className="text-muted-foreground animate-pulse">載入中...</p>
            </div>
        </div>
    )
}
