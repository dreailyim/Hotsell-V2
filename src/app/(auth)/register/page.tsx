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

export default function RegisterPage() {
  const { user, loading: authLoading, signUp } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // If the user is already logged in, redirect to the home page.
    if (!authLoading && user) {
      router.push('/');
    }
  }, [user, authLoading, router]);


  const getFriendlyErrorMessage = (error: FirebaseError): string => {
      switch (error.code) {
          case 'auth/email-already-in-use':
              return '此電郵地址已被註冊。';
          case 'auth/weak-password':
              return '密碼強度不足，請設定至少6位數的密碼。';
          case 'auth/invalid-email':
              return '電郵地址格式不正確。';
          default:
              return `發生未知錯誤: ${error.code}`;
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
            title: '註冊失敗',
            description: '兩次輸入的密碼不一致。',
            variant: 'destructive',
        });
        setLoading(false);
        return;
    }

    try {
      await signUp(email, password, displayName);
      toast({ title: '註冊成功！', description: '驗證郵件已寄出，請檢查您的收件箱。' });
      router.push('/login');
    } catch (error) {
      if (error instanceof FirebaseError) {
        toast({
          title: '註冊失敗',
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
  
  if (authLoading || user) {
     return (
        <div className="flex min-h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
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
            <CardTitle>註冊</CardTitle>
            <CardDescription>建立一個新帳戶。</CardDescription>
          </CardHeader>
            <form onSubmit={handleSignUp}>
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
              <div className="space-y-2">
                <Label htmlFor="signup-confirm-password">確認密碼</Label>
                <Input id="signup-confirm-password" name="confirm-password" type="password" required />
              </div>
            </CardContent>
            <CardFooter className="flex-col gap-4">
              <Button className="w-full rounded-full bg-gradient-to-r from-orange-500 to-red-600 text-primary-foreground dark:text-black hover:opacity-90 transition-opacity" type="submit" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                註冊
              </Button>
            </CardFooter>
          </form>
        </Card>
        <div className="text-center text-sm">
            已經有帳戶？ <Link href="/login" className="underline">立即登入</Link>
        </div>
      </div>
    </div>
  );
}
