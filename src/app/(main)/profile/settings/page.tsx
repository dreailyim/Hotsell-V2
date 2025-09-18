
'use client';

import { useState, useTransition, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { updateDoc, doc } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase/client-app';
import { Loader2, Bell, BellOff, Camera } from 'lucide-react';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
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

export default function SettingsPage() {
  const { user, signOut, loading: authLoading, updateAuthProfile } = useAuth();
  const { toast } = useToast();

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [aboutMe, setAboutMe] = useState(user?.aboutMe || '');
  const [newAvatar, setNewAvatar] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [notificationPermission, setNotificationPermission] = useState('default');

  const fileInputRef = useRef<HTMLInputElement>(null);

   useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const handleNotificationToggle = useCallback(async (checked: boolean) => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
        toast({ title: '您的瀏覽器不支援通知功能', variant: 'destructive' });
        return;
    }
    
    if (checked) {
      if (Notification.permission === 'granted') {
          // Already granted, maybe re-register token just in case
          toast({ title: '通知權限已開啟' });
          // Ideally, trigger token refresh/reregistration logic here from useFcm
      } else if (Notification.permission === 'denied') {
          toast({ title: '通知已被封鎖', description: '請在您的瀏覽器設定中手動解除封鎖。', variant: 'destructive' });
          return; // Don't try to request if denied
      } else {
        const permission = await Notification.requestPermission();
        setNotificationPermission(permission);
        if (permission === 'granted') {
            toast({ title: '通知已成功開啟！' });
            // Rerun fcm logic to get token
            window.location.reload(); // Simple way to re-trigger the useFcm hook
        } else {
            toast({ title: '未授予通知權限', variant: 'destructive' });
        }
      }
    } else {
        toast({ title: '如要關閉通知，請在瀏覽器設定中操作' });
    }
     setNotificationPermission(Notification.permission);
  }, [toast]);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
       if (file.size > 2 * 1024 * 1024) { // 2MB limit
        toast({ title: '圖片太大', description: '請上傳小於 2MB 的圖片。', variant: 'destructive' });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;

    startTransition(async () => {
        setIsUploading(true);
        let photoURL = user.photoURL;

        try {
            if (newAvatar) {
                const storageRef = ref(storage, `avatars/${user.uid}/profile.jpg`);
                await uploadString(storageRef, newAvatar, 'data_url');
                photoURL = await getDownloadURL(storageRef);
            }

            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
                displayName,
                aboutMe,
                photoURL,
            });

            await updateAuthProfile({ displayName, photoURL });
            
            toast({ title: '個人資料已更新' });
            setNewAvatar(null); // Clear preview

        } catch (error: any) {
            console.error('Error updating profile:', error);
            toast({ title: '更新失敗', description: error.message, variant: 'destructive' });
        } finally {
            setIsUploading(false);
        }
    });
  };

  if (authLoading) {
    return (
       <div className="flex min-h-screen items-center justify-center">
         <Loader2 className="h-8 w-8 animate-spin" />
       </div>
    )
  }

  if (!user) {
    // This case should ideally be handled by a route guard or middleware
    return (
       <div className="flex min-h-screen items-center justify-center text-center">
            <div>
                 <h1 className="text-2xl font-bold">請先登入</h1>
                 <p className="text-muted-foreground">您需要登入才能查看此頁面。</p>
            </div>
        </div>
    )
  }

  const isSaveDisabled = isPending || isUploading;

  return (
    <>
      <Header title="設定" showBackButton />
      <div className="container mx-auto max-w-2xl px-4 md:px-6 py-8 space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>個人檔案</CardTitle>
            <CardDescription>更新您的公開個人資料。這將會顯示在您的個人主頁和商品頁面上。</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleProfileUpdate} className="space-y-6">
                <div className="flex items-center gap-4">
                     <div className="relative group flex-shrink-0">
                         <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            className="hidden"
                            accept="image/png, image/jpeg"
                          />
                         <Avatar className="h-20 w-20 cursor-pointer" onClick={handleAvatarClick}>
                            <AvatarImage src={newAvatar || user.photoURL || undefined} alt={user.displayName || '用戶頭像'} />
                            <AvatarFallback>{user.displayName?.charAt(0) || 'U'}</AvatarFallback>
                        </Avatar>
                         <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" onClick={handleAvatarClick}>
                            <Camera className="h-8 w-8 text-white" />
                        </div>
                    </div>
                    <div className="flex-1 space-y-4">
                        <div className='space-y-1.5'>
                            <Label htmlFor="displayName">顯示名稱</Label>
                            <Input
                              id="displayName"
                              value={displayName}
                              onChange={(e) => setDisplayName(e.target.value)}
                              disabled={isSaveDisabled}
                            />
                        </div>
                         <div className='space-y-1.5'>
                            <Label htmlFor="email">電郵地址</Label>
                            <Input
                              id="email"
                              value={user.email || ''}
                              disabled
                            />
                        </div>
                    </div>
                </div>

              <div className="space-y-2">
                <Label htmlFor="aboutMe">關於我</Label>
                <Textarea
                  id="aboutMe"
                  value={aboutMe}
                  onChange={(e) => setAboutMe(e.target.value)}
                  placeholder="告訴大家一些關於您的事..."
                  disabled={isSaveDisabled}
                  className="min-h-[120px]"
                />
              </div>
              <Button type="submit" disabled={isSaveDisabled} className="w-full sm:w-auto rounded-full bg-gradient-to-r from-blue-500 to-sky-500 dark:text-primary-foreground hover:opacity-90 transition-opacity">
                {(isPending || isUploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                儲存變更
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>通知</CardTitle>
                <CardDescription>管理您的推播通知設定。</CardDescription>
            </CardHeader>
            <CardContent>
                 <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                        {notificationPermission === 'granted' ? <Bell className="h-5 w-5 text-primary" /> : <BellOff className="h-5 w-5 text-muted-foreground" />}
                        <Label htmlFor="notifications-switch" className="font-medium cursor-pointer">
                            推播通知
                        </Label>
                    </div>
                    <Switch
                        id="notifications-switch"
                        checked={notificationPermission === 'granted'}
                        onCheckedChange={handleNotificationToggle}
                        aria-readonly
                    />
                </div>
                 {notificationPermission === 'denied' && (
                    <p className="text-xs text-destructive mt-2 pl-2">您已封鎖通知。請在瀏覽器設定中重新啟用它。</p>
                )}
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>佈景主題</CardTitle>
                <CardDescription>選擇您喜歡的應用程式外觀。</CardDescription>
            </CardHeader>
            <CardContent>
                <ThemeToggle />
            </CardContent>
        </Card>
        
        <div className="flex flex-col items-center gap-4 pt-4">
             <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full max-w-xs rounded-full bg-gradient-to-r from-orange-500 to-red-600 text-primary-foreground dark:text-black hover:opacity-90 transition-opacity">登出</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>確定要登出嗎？</AlertDialogTitle>
                  <AlertDialogDescription>
                    您將會被登出此帳戶，需要重新登入才能繼續使用。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={signOut}
                    className="bg-gradient-to-r from-orange-500 to-red-600 text-primary-foreground dark:text-black hover:opacity-90 transition-opacity"
                  >
                   確認登出
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
        </div>
      </div>
    </>
  );
}

    