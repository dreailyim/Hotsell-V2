
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
import { Loader2, Bell, BellOff, Camera, AlertTriangle, Flame, Info, ChevronRight, MessageCircle, Mail, Phone } from 'lucide-react';
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
import packageInfo from '@/../package.json';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';
import React from 'react';

export default function SettingsPage() {
  const { user, signOut, loading: authLoading, updateAuthProfile, deleteAccount } = useAuth();
  const { toast } = useToast();

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || '');
  const [city, setCity] = useState(user?.city || '');
  const [aboutMe, setAboutMe] = useState(user?.aboutMe || '');
  const [newAvatar, setNewAvatar] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [password, setPassword] = useState('');
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
                phoneNumber,
                aboutMe,
                photoURL,
                city,
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

  const handleDeleteAccount = async () => {
      if (!password) {
        toast({ title: '請輸入密碼', variant: 'destructive' });
        return;
      }
      startTransition(async () => {
          try {
              await deleteAccount(password);
              toast({ title: '帳戶已成功註銷' });
              // The onAuthStateChanged listener in useAuth will handle the redirect.
          } catch (error: any) {
              let description = '發生未知錯誤，請稍後再試。';
              if (error.code === 'auth/requires-recent-login' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                  description = '密碼錯誤或您的登入憑證已過期，請重新登入後再試。';
              }
              toast({
                  title: '註銷失敗',
                  description: description,
                  variant: 'destructive',
              });
          }
      });
  }

  if (authLoading) {
    return (
       <div className="flex min-h-screen items-center justify-center">
            <div className="flex flex-col items-center justify-center gap-4">
                <Flame className="h-16 w-16 text-primary animate-burn" />
                <p className="text-muted-foreground animate-pulse">載入中...</p>
            </div>
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

  const supportLinks = [
    { href: "https://wa.me/85212345678", icon: <MessageCircle className="h-5 w-5 text-green-500" />, label: "WhatsApp" },
    { href: "https://signal.me/#p/+85212345678", icon: <Phone className="h-5 w-5 text-blue-500" />, label: "Signal" },
    { href: "mailto:support@example.com", icon: <Mail className="h-5 w-5 text-muted-foreground" />, label: "Email" },
  ];

  return (
    <>
      <Header title="設定" showBackButton />
      <div className="container mx-auto max-w-2xl px-4 md:px-6 py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">個人檔案</CardTitle>
            <CardDescription className="text-sm">更新您的公開個人資料。這將會顯示在您的個人主頁和商品頁面上。</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleProfileUpdate} className="space-y-4">
                <div className="flex items-center gap-4">
                     <div className="relative group flex-shrink-0">
                         <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            className="hidden"
                            accept="image/png, image/jpeg"
                          />
                         <Avatar className="h-16 w-16 cursor-pointer" onClick={handleAvatarClick}>
                            <AvatarImage src={newAvatar || user.photoURL || undefined} alt={user.displayName || '用戶頭像'} />
                            <AvatarFallback>{user.displayName?.charAt(0) || 'U'}</AvatarFallback>
                        </Avatar>
                         <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" onClick={handleAvatarClick}>
                            <Camera className="h-6 w-6 text-white" />
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
                         <div className='space-y-1.5'>
                            <Label htmlFor="phone">電話號碼</Label>
                            <Input
                              id="phone"
                              value={phoneNumber || ''}
                              onChange={(e) => setPhoneNumber(e.target.value)}
                              placeholder="尚未提供"
                              disabled={isSaveDisabled}
                            />
                        </div>
                    </div>
                </div>
                
                <div className="space-y-1.5">
                    <Label htmlFor="city">我的城市</Label>
                    <div className="flex items-center gap-2">
                        <Select onValueChange={setCity} value={city} disabled={isSaveDisabled}>
                            <SelectTrigger id="city">
                                <SelectValue placeholder="選擇您所在的城市" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectLabel>香港島</SelectLabel>
                                    <SelectItem value="中西區">中西區</SelectItem>
                                    <SelectItem value="灣仔區">灣仔區</SelectItem>
                                    <SelectItem value="東區">東區</SelectItem>
                                    <SelectItem value="南區">南區</SelectItem>
                                </SelectGroup>
                                <SelectGroup>
                                    <SelectLabel>九龍</SelectLabel>
                                    <SelectItem value="油尖旺區">油尖旺區</SelectItem>
                                    <SelectItem value="深水埗區">深水埗區</SelectItem>
                                    <SelectItem value="九龍城區">九龍城區</SelectItem>
                                    <SelectItem value="黃大仙區">黃大仙區</SelectItem>
                                    <SelectItem value="觀塘區">觀塘區</SelectItem>
                                </SelectGroup>
                                <SelectGroup>
                                    <SelectLabel>新界</SelectLabel>
                                    <SelectItem value="葵青區">葵青區</SelectItem>
                                    <SelectItem value="荃灣區">荃灣區</SelectItem>
                                    <SelectItem value="屯門區">屯門區</SelectItem>
                                    <SelectItem value="元朗區">元朗區</SelectItem>
                                    <SelectItem value="北區">北區</SelectItem>
                                    <SelectItem value="大埔區">大埔區</SelectItem>
                                    <SelectItem value="沙田區">沙田區</SelectItem>
                                    <SelectItem value="西貢區">西貢區</SelectItem>
                                    <SelectItem value="離島區">離島區</SelectItem>
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

              <div className="space-y-1.5">
                <Label htmlFor="aboutMe">關於我</Label>
                <Textarea
                  id="aboutMe"
                  value={aboutMe}
                  onChange={(e) => setAboutMe(e.target.value)}
                  placeholder="告訴大家一些關於您的事..."
                  disabled={isSaveDisabled}
                  className="min-h-[100px]"
                />
              </div>
              <Button type="submit" disabled={isSaveDisabled} className="w-full sm:w-auto rounded-full bg-gradient-to-r from-blue-500 to-sky-500 text-primary-foreground dark:text-black hover:opacity-90 transition-opacity">
                {(isPending || isUploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                儲存變更
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle className="text-lg">通知</CardTitle>
                <CardDescription className="text-sm">管理您的推播通知設定。</CardDescription>
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
                <CardTitle className="text-lg">佈景主題</CardTitle>
                <CardDescription className="text-sm">選擇您喜歡的應用程式外觀。</CardDescription>
            </CardHeader>
            <CardContent>
                <ThemeToggle />
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle className="text-lg">關於我們</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="divide-y divide-border">
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <button className="flex w-full items-center justify-between p-3 hover:bg-muted/50 transition-colors">
                                <div className="flex items-center gap-4">
                                    <Info className="h-5 w-5 text-muted-foreground" />
                                    <span className="text-sm">免責聲明</span>
                                </div>
                                <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>免責聲明</AlertDialogTitle>
                                <AlertDialogDescription className="max-h-[60vh] overflow-y-auto">
                                    此應用程式 (HotSell) 僅作為技術展示和個人專案用途。所有顯示的商品、價格、用戶資料和交易均為模擬數據，並非真實。
                                    <br /><br />
                                    請勿在此應用程式上分享任何真實的個人敏感資訊或進行任何真實的金融交易。開發者對因使用此應用程式而導致的任何形式的損失或損害概不負責。
                                    <br /><br />
                                    所有圖片均來自公開的圖片服務 (Picsum Photos)，版權歸原作者所有。
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogAction>我已了解</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </CardContent>
        </Card>

         <Card>
            <CardHeader>
                <CardTitle className="text-lg">技術支援</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div>
                    {supportLinks.map((link, index) => (
                        <React.Fragment key={link.href}>
                            <Link href={link.href} target="_blank" className="flex w-full items-center justify-between p-3 hover:bg-muted/50 transition-colors">
                                <div className="flex items-center gap-4">
                                    {link.icon}
                                    <span className="text-sm">{link.label}</span>
                                </div>
                                <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            </Link>
                            {index < supportLinks.length - 1 && (
                                <div className="h-px w-full bg-gradient-to-r from-transparent via-border to-transparent" />
                            )}
                        </React.Fragment>
                    ))}
                </div>
            </CardContent>
        </Card>


        <div className="flex justify-center pt-4">
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button className="w-full max-w-xs rounded-full bg-gradient-to-r from-orange-500 to-red-600 text-primary-foreground dark:text-black hover:opacity-90 transition-opacity">登出</Button>
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
                        className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                    >
                        確認登出
                    </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
        
        <Card className="border-destructive">
            <CardHeader>
                <CardTitle className="text-destructive text-lg">危險區域</CardTitle>
                <CardDescription className="text-sm">以下操作將會永久改變您的帳戶狀態，請謹慎操作。</CardDescription>
            </CardHeader>
            <CardContent>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="outline" className="w-full max-w-xs rounded-full border-destructive text-destructive hover:bg-destructive/10">註銷帳戶</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader className="text-left">
                            <AlertDialogTitle>
                                <div className="flex items-center gap-2">
                                     <AlertTriangle className="text-destructive" /> 確定要註銷帳戶嗎？
                                </div>
                            </AlertDialogTitle>
                            <AlertDialogDescription dangerouslySetInnerHTML={{ __html: '這個操作<strong>無法復原</strong>。您的所有個人資料、刊登的商品、以及評價等都將被<strong>永久刪除</strong>。為確認此操作，請輸入您目前的登入密碼。' }} />
                        </AlertDialogHeader>
                        <div className="py-2">
                            <Label htmlFor="delete-password" className="sr-only">密碼</Label>
                            <Input
                                id="delete-password"
                                type="password"
                                placeholder="請在此輸入您的密碼"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-col gap-2 mt-4">
                            <Button
                                onClick={handleDeleteAccount}
                                disabled={isPending || !password}
                                variant="destructive"
                                className="w-full rounded-full"
                            >
                                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                我確認，註銷我的帳戶
                            </Button>
                            <AlertDialogCancel asChild>
                                <Button variant="outline" className="w-full rounded-full" onClick={() => setPassword('')}>取消</Button>
                            </AlertDialogCancel>
                        </div>
                    </AlertDialogContent>
                </AlertDialog>
            </CardContent>
        </Card>
        
        <div className="text-center text-xs text-muted-foreground pt-4">
            App Version: {packageInfo.version || 'N/A'}
        </div>
      </div>
    </>
  );
}

    
