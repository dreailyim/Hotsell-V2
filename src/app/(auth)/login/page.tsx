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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/use-auth';
import { FirebaseError } from 'firebase/app';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const { user, loading: authLoading, signUp, signIn, signInWithGoogle, sendPasswordReset } = useAuth();
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


  const handleAuthAction = async (
    action: 'signUp' | 'signIn',
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setLoading(true);
    const formData = new FormData(event.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    try {
      if (action === 'signUp') {
        const displayName = formData.get('displayName') as string;
        await signUp(email, password, displayName);
        toast({ title: '註冊成功！', description: '歡迎加入 HotSell！' });
      } else {
        await signIn(email, password);
        toast({ title: '登入成功！', description: '很高興您回來！' });
      }
      // The useEffect hook will handle the redirect
    } catch (error) {
      if (error instanceof FirebaseError) {
        toast({
          title: action === 'signUp' ? '註冊失敗' : '登入失敗',
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
  
  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
        await signInWithGoogle();
        toast({ title: 'Google 登入成功！', description: '很高興您回來！' });
        // The useEffect hook will handle the redirect
    } catch (error) {
         if (error instanceof FirebaseError) {
            toast({
              title: 'Google 登入失敗',
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
  }

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
            <Loader2 className="h-8 w-8 animate-spin" />
        </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Tabs defaultValue="login" className="w-[400px]">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">登入</TabsTrigger>
          <TabsTrigger value="signup">註冊</TabsTrigger>
        </TabsList>
        <TabsContent value="login">
          <Card>
            <CardHeader>
              <CardTitle>登入</CardTitle>
              <CardDescription>使用您的帳戶繼續。</CardDescription>
            </CardHeader>
            <form onSubmit={(e) => handleAuthAction('signIn', e)}>
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
                                <AlertDialogCancel className="rounded-full">取消</AlertDialogCancel>
                                <AlertDialogAction onClick={handlePasswordReset} disabled={loading} className="rounded-full bg-gradient-to-r from-orange-500 to-red-600 text-primary-foreground dark:text-black hover:opacity-90 transition-opacity">
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
                <Button variant="outline" className="w-full rounded-full" onClick={handleGoogleSignIn} type="button" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  使用 Google 登入
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>
        <TabsContent value="signup">
          <Card>
            <CardHeader>
              <CardTitle>註冊</CardTitle>
              <CardDescription>建立一個新帳戶。</CardDescription>
            </CardHeader>
             <form onSubmit={(e) => handleAuthAction('signUp', e)}>
              <CardContent className="space-y-4">
                 <div className="space-y-2">
                  <Label htmlFor="signup-displayName">顯示名稱</Label>
                  <Input id="signup-displayName" name="displayName" type="text" placeholder="您的名稱" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">電子郵件</Label>
                  <Input id="signup-email" name="email" type="email" placeholder="m@example.com" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">密碼</Label>
                  <Input id="signup-password" name="password" type="password" required />
                </div>
              </CardContent>
              <CardFooter className="flex-col gap-4">
                <Button className="w-full rounded-full bg-gradient-to-r from-orange-500 to-red-600 text-primary-foreground dark:text-black hover:opacity-90 transition-opacity" type="submit" disabled={loading}>
                   {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  註冊
                </Button>
                 <Button variant="outline" className="w-full rounded-full" onClick={handleGoogleSignIn} type="button" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  使用 Google 註冊
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

    