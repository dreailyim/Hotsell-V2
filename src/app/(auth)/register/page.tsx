
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/use-auth';
import { FirebaseError } from 'firebase/app';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Flame } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/hooks/use-translation';
import { LanguageSwitcher } from '@/components/language-switcher';

export default function RegisterPage() {
  const { user, loading: authLoading, signUp } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { t } = useTranslation();

  useEffect(() => {
    // If the user is already logged in, redirect to the home page.
    if (!authLoading && user) {
      router.push('/');
    }
  }, [user, authLoading, router]);


  const getFriendlyErrorMessage = (error: FirebaseError): string => {
      switch (error.code) {
          case 'auth/email-already-in-use':
              return t('register.error.email_in_use');
          case 'auth/weak-password':
              return t('register.error.weak_password');
          case 'auth/invalid-email':
              return t('register.error.invalid_email');
          default:
              return t('login.error.unknown').replace('{error_code}', error.code);
      }
  };

  const handleSignUp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    const formData = new FormData(event.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirm-password') as string;
    const displayName = formData.get('displayName') as string;

    if (password !== confirmPassword) {
        toast({
            title: t('register.fail_title'),
            description: t('register.error.password_mismatch'),
            variant: 'destructive',
        });
        setLoading(false);
        return;
    }

    try {
      await signUp(email, password, displayName);
      // Redirect to login page with a query param to show a success message
      router.push('/login?verify_email=true');
    } catch (error) {
      if (error instanceof FirebaseError) {
        toast({
          title: t('register.fail_title'),
          description: getFriendlyErrorMessage(error),
          variant: 'destructive',
        });
      } else {
        toast({
          title: t('login.unknown_error_title'),
          description: String(error),
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };
  
  if (authLoading || user) {
     return (
        <div className="flex min-h-screen items-center justify-center">
            <div className="flex flex-col items-center justify-center gap-4">
                <Flame className="h-16 w-16 text-primary animate-burn" />
                <p className="text-muted-foreground animate-pulse">{t('loading')}</p>
            </div>
        </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="flex flex-col items-center justify-center space-y-2">
            <Flame className="h-12 w-12 text-primary animate-burn" />
            <h1 className="text-2xl font-bold tracking-tight text-primary">HotSell</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{t('register.title')}</CardTitle>
            <CardDescription>{t('register.description')}</CardDescription>
          </CardHeader>
            <form onSubmit={handleSignUp}>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                <Label htmlFor="signup-displayName">{t('register.display_name_label')}</Label>
                <Input id="signup-displayName" name="displayName" type="text" placeholder={t('register.display_name_placeholder')} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-email">{t('login.email_label')}</Label>
                <Input id="signup-email" name="email" type="email" placeholder="m@example.com" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">{t('login.password_label')}</Label>
                <Input id="signup-password" name="password" type="password" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-confirm-password">{t('register.confirm_password_label')}</Label>
                <Input id="signup-confirm-password" name="confirm-password" type="password" required />
              </div>
            </CardContent>
            <CardFooter className="flex-col gap-4">
              <Button className="w-full rounded-full bg-gradient-to-r from-orange-500 to-red-600 text-primary-foreground dark:text-black hover:opacity-90 transition-opacity" type="submit" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('register.register_button')}
              </Button>
            </CardFooter>
          </form>
        </Card>
        <div className="text-center text-sm">
            {t('register.has_account')} <Link href="/login" className="underline">{t('register.login_now')}</Link>
        </div>
        <LanguageSwitcher />
      </div>
    </div>
  );
}
