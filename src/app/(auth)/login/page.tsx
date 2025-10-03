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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/use-auth';
import { FirebaseError } from 'firebase/app';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Flame } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { LanguageSwitcher } from '@/components/language-switcher';


export default function LoginPage() {
  const { user, loading: authLoading, signIn, sendPasswordReset } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
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
          case 'auth/user-not-found':
              return t('login.error.user_not_found');
          case 'auth/wrong-password':
          case 'auth/invalid-credential':
              return t('login.error.wrong_password');
          case 'auth/email-already-in-use':
              return t('login.error.email_in_use');
          case 'auth/weak-password':
              return t('login.error.weak_password');
          default:
              return t('login.error.unknown').replace('{error_code}', error.code);
      }
  };


  const handleSignIn = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setLoading(true);
    const formData = new FormData(event.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    try {
      await signIn(email, password);
      toast({ title: t('login.success_title'), description: t('login.success_desc') });
      // The useEffect hook will handle the redirect
    } catch (error) {
      if (error instanceof FirebaseError) {
        toast({
          title: t('login.fail_title'),
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

  const handlePasswordReset = async () => {
    if (!resetEmail) {
        toast({ title: t('login.reset_password.email_required'), variant: 'destructive' });
        return;
    }
    setLoading(true);
    try {
        await sendPasswordReset(resetEmail);
        toast({
            title: t('login.reset_password.success_title'),
            description: t('login.reset_password.success_desc')
        });
    } catch (error) {
        if (error instanceof FirebaseError) {
            toast({
                title: t('login.reset_password.fail_title'),
                description: getFriendlyErrorMessage(error),
                variant: 'destructive'
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
            <CardTitle>{t('login.title')}</CardTitle>
            <CardDescription>{t('login.description')}</CardDescription>
          </CardHeader>
          <form onSubmit={handleSignIn}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">{t('login.email_label')}</Label>
                <Input id="login-email" name="email" type="email" placeholder="m@example.com" required />
              </div>
              <div className="space-y-2">
                  <div className="flex items-center justify-between">
                      <Label htmlFor="login-password">{t('login.password_label')}</Label>
                      <AlertDialog>
                          <AlertDialogTrigger asChild>
                              <Button variant="link" type="button" className="text-xs p-0 h-auto">{t('login.forgot_password')}</Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                              <AlertDialogHeader>
                              <AlertDialogTitle>{t('login.reset_password.title')}</AlertDialogTitle>
                              <AlertDialogDescription>
                                  {t('login.reset_password.description')}
                              </AlertDialogDescription>
                              </AlertDialogHeader>
                              <div className="grid gap-4 py-4">
                                  <div className="grid grid-cols-4 items-center gap-4">
                                      <Label htmlFor="reset-email" className="text-right">
                                      {t('login.reset_password.email_label')}
                                      </Label>
                                      <Input
                                          id="reset-email"
                                          type="email"
                                          value={resetEmail}
                                          onChange={(e) => setResetEmail(e.target.value)}
                                          className="col-span-3"
                                          placeholder="m@example.com"
                                      />
                                  </div>
                              </div>
                              <AlertDialogFooter>
                              <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                              <AlertDialogAction onClick={handlePasswordReset} disabled={loading}>
                                   {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                  {t('login.reset_password.send_button')}
                              </AlertDialogAction>
                              </AlertDialogFooter>
                          </AlertDialogContent>
                      </AlertDialog>
                  </div>
                <Input id="login-password" name="password" type="password" required />
              </div>
            </CardContent>
            <CardFooter className="flex-col gap-4">
              <Button className="w-full rounded-full bg-gradient-to-r from-orange-500 to-red-600 text-primary-foreground dark:text-black hover:opacity-90 transition-opacity" type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('login.login_button')}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <div className="text-center text-sm">
            {t('login.no_account')} <Link href="/register" className="underline">{t('login.register_now')}</Link>
        </div>
        <LanguageSwitcher />

      </div>
    </div>
  );
}
