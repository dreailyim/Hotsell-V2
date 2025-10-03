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

export default function LoginPage() {
  const { user, loading: authLoading, signIn, sendPasswordReset } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const router = useRouter();

  useEffect(() => {
    // If the user is already logged in, redirect to the home page.
    if (!authLoading && user) {
      router.push('/');
    }
  }, [user, authLoading, router]);


  const getFriendlyErrorMessage = (error: FirebaseError): string => {
      switch (error.code) {
          case 'auth/user-not-found':
              return '找不到此用戶，請檢查電郵地址是否正確。';
          case 'auth/wrong-password':
          case 'auth/invalid-credential':
              return '密碼錯誤，請再試一次。';
          case 'auth/email-already-in-use':
              return '此電郵地址已被註冊。';
          case 'auth/weak-password':
              return '密碼強度不足，請設定至少6位數的密碼。';
          default:
              return `發生未知錯誤: ${error.code}`;
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
      toast({ title: '登入成功！', description: '很高興您回來！' });
      // The useEffect hook will handle the redirect
    } catch (error) {
      if (error instanceof FirebaseError) {
        toast({
          title: '登入失敗',
          description: getFriendlyErrorMessage(error),
          variant: 'destructive',
        });
      } else {
        toast({
          title: '發生未知錯誤',
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
        toast({ title: '請輸入電郵地址', variant: 'destructive' });
        return;
    }
    setLoading(true);
    try {
        await sendPasswordReset(resetEmail);
        toast({
            title: '重設郵件已寄出',
            description: '請檢查您的收件箱，並按照郵件中的指示重設密碼。'
        });
    } catch (error) {
        if (error instanceof FirebaseError) {
            toast({
                title: '郵件寄送失敗',
                description: getFriendlyErrorMessage(error),
                variant: 'destructive'
            });
        } else {
             toast({
              title: '發生未知錯誤',
              description: String(error),
              variant: 'destructive',
            });
        }
    } finally {
        setLoading(false);
    }
  };
  
  // While checking auth state, or if user is logged in, don't render the form
  if (authLoading || user) {
     return (
        <div className="flex min-h-screen items-center justify-center">
            <div className="flex flex-col items-center justify-center gap-4">
                <Flame className="h-16 w-16 text-primary animate-burn" />
                <p className="text-muted-foreground animate-pulse">載入中...</p>
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
            <CardTitle>登入</CardTitle>
            <CardDescription>使用您的帳戶繼續。</CardDescription>
          </CardHeader>
          <form onSubmit={handleSignIn}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">電子郵件</Label>
                <Input id="login-email" name="email" type="email" placeholder="m@example.com" required />
              </div>
              <div className="space-y-2">
                  <div className="flex items-center justify-between">
                      <Label htmlFor="login-password">密碼</Label>
                      <AlertDialog>
                          <AlertDialogTrigger asChild>
                              <Button variant="link" type="button" className="text-xs p-0 h-auto">忘記密碼？</Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                              <AlertDialogHeader>
                              <AlertDialogTitle>重設您的密碼</AlertDialogTitle>
                              <AlertDialogDescription>
                                  請輸入您的帳戶電郵地址，我們將會寄送密碼重設連結給您。
                              </AlertDialogDescription>
                              </AlertDialogHeader>
                              <div className="grid gap-4 py-4">
                                  <div className="grid grid-cols-4 items-center gap-4">
                                      <Label htmlFor="reset-email" className="text-right">
                                      電郵
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
                              <AlertDialogCancel>取消</AlertDialogCancel>
                              <AlertDialogAction onClick={handlePasswordReset} disabled={loading}>
                                   {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                  傳送重設郵件
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
                登入
              </Button>
            </CardFooter>
          </form>
        </Card>

        <div className="text-center text-sm">
            還沒有帳戶？ <Link href="/register" className="underline">立即註冊</Link>
        </div>

      </div>
    </div>
  );
}
