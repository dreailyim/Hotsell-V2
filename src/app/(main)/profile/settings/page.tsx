
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
import { Loader2, Bell, BellOff, Camera, AlertTriangle, Flame, Info, ChevronRight, MessageCircle, Mail, Phone, Languages } from 'lucide-react';
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
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';

function LanguageSwitcher() {
  const { language, setLanguage, t } = useTranslation();

  return (
      <Card>
          <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Languages className="h-5 w-5" /> {t('settings.language.title')}</CardTitle>
              <CardDescription className="text-sm">{t('settings.language.description')}</CardDescription>
          </CardHeader>
          <CardContent>
              <div className="flex gap-2 rounded-lg bg-muted p-1">
                  <Button
                      onClick={() => setLanguage('zh')}
                      className={cn("flex-1 justify-center", language === 'zh' ? 'bg-background text-foreground shadow-sm' : 'bg-transparent text-muted-foreground')}
                      variant="ghost"
                  >
                      繁體中文
                  </Button>
                  <Button
                      onClick={() => setLanguage('en')}
                      className={cn("flex-1 justify-center", language === 'en' ? 'bg-background text-foreground shadow-sm' : 'bg-transparent text-muted-foreground')}
                      variant="ghost"
                  >
                      English
                  </Button>
              </div>
          </CardContent>
      </Card>
  )
}

export default function SettingsPage() {
  const { user, signOut, loading: authLoading, updateAuthProfile, deleteAccount } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();

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
        toast({ title: t('settings.notifications.browser_unsupported'), variant: 'destructive' });
        return;
    }
    
    if (checked) {
      if (Notification.permission === 'granted') {
          toast({ title: t('settings.notifications.already_on') });
      } else if (Notification.permission === 'denied') {
          toast({ title: t('settings.notifications.denied'), variant: 'destructive' });
          return;
      } else {
        const permission = await Notification.requestPermission();
        setNotificationPermission(permission);
        if (permission === 'granted') {
            toast({ title: t('settings.notifications.request_success') });
            window.location.reload();
        } else {
            toast({ title: t('settings.notifications.request_fail'), variant: 'destructive' });
        }
      }
    } else {
        toast({ title: t('settings.notifications.turn_on_prompt') });
    }
     setNotificationPermission(Notification.permission);
  }, [toast, t]);

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
            
            toast({ title: t('settings.profile.update_success') });
            setNewAvatar(null);

        } catch (error: any) {
            console.error('Error updating profile:', error);
            toast({ title: t('settings.profile.update_fail'), description: error.message, variant: 'destructive' });
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
              toast({ title: t('settings.danger_zone.delete_success') });
          } catch (error: any) {
              let description = t('settings.danger_zone.delete_fail');
              if (error.code === 'auth/requires-recent-login' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                  description = t('settings.danger_zone.delete_fail.reauth');
              }
              toast({
                  title: t('settings.danger_zone.delete_fail'),
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
                <p className="text-muted-foreground animate-pulse">{t('loading')}</p>
            </div>
       </div>
    )
  }

  if (!user) {
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
      <Header title={t('header.title.settings')} showBackButton />
      <div className="container mx-auto max-w-2xl px-4 md:px-6 py-8 space-y-6">
        
        <LanguageSwitcher />

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('settings.profile.title')}</CardTitle>
            <CardDescription className="text-sm">{t('settings.profile.description')}</CardDescription>
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
                            <Label htmlFor="displayName">{t('settings.profile.display_name')}</Label>
                            <Input
                              id="displayName"
                              value={displayName}
                              onChange={(e) => setDisplayName(e.target.value)}
                              disabled={isSaveDisabled}
                            />
                        </div>
                         <div className='space-y-1.5'>
                            <Label htmlFor="email">{t('settings.profile.email')}</Label>
                            <Input
                              id="email"
                              value={user.email || ''}
                              disabled
                            />
                        </div>
                         <div className='space-y-1.5'>
                            <Label htmlFor="phone">{t('settings.profile.phone')}</Label>
                            <Input
                              id="phone"
                              value={phoneNumber || ''}
                              onChange={(e) => setPhoneNumber(e.target.value)}
                              placeholder={t('settings.profile.phone.placeholder')}
                              disabled={isSaveDisabled}
                            />
                        </div>
                    </div>
                </div>
                
                <div className="space-y-1.5">
                    <Label htmlFor="city">{t('settings.profile.city')}</Label>
                    <div className="flex items-center gap-2">
                        <Select onValueChange={setCity} value={city} disabled={isSaveDisabled}>
                            <SelectTrigger id="city">
                                <SelectValue placeholder={t('settings.profile.city.placeholder')} />
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
                <Label htmlFor="aboutMe">{t('settings.profile.about_me')}</Label>
                <Textarea
                  id="aboutMe"
                  value={aboutMe}
                  onChange={(e) => setAboutMe(e.target.value)}
                  placeholder={t('settings.profile.about_me.placeholder')}
                  disabled={isSaveDisabled}
                  className="min-h-[100px]"
                />
              </div>
              <Button type="submit" disabled={isSaveDisabled} className="w-full sm:w-auto rounded-full bg-gradient-to-r from-blue-500 to-sky-500 text-primary-foreground dark:text-black hover:opacity-90 transition-opacity">
                {(isPending || isUploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('settings.profile.save_button')}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle className="text-lg">{t('settings.notifications.title')}</CardTitle>
                <CardDescription className="text-sm">{t('settings.notifications.description')}</CardDescription>
            </CardHeader>
            <CardContent>
                 <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                        {notificationPermission === 'granted' ? <Bell className="h-5 w-5 text-primary" /> : <BellOff className="h-5 w-5 text-muted-foreground" />}
                        <Label htmlFor="notifications-switch" className="font-medium cursor-pointer">
                            {t('settings.notifications.push')}
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
                    <p className="text-xs text-destructive mt-2 pl-2">{t('settings.notifications.denied')}</p>
                )}
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle className="text-lg">{t('settings.theme.title')}</CardTitle>
                <CardDescription className="text-sm">{t('settings.theme.description')}</CardDescription>
            </CardHeader>
            <CardContent>
                <ThemeToggle />
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle className="text-lg">{t('settings.about.title')}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="divide-y divide-border">
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <button className="flex w-full items-center justify-between p-3 hover:bg-muted/50 transition-colors">
                                <div className="flex items-center gap-4">
                                    <Info className="h-5 w-5 text-muted-foreground" />
                                    <span className="text-sm">{t('settings.about.disclaimer')}</span>
                                </div>
                                <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>{t('settings.about.disclaimer')}</AlertDialogTitle>
                                <AlertDialogDescription className="max-h-[60vh] overflow-y-auto">
                                    {t('settings.about.disclaimer.content').split('\n\n').map((paragraph, index) => (
                                        <React.Fragment key={index}>
                                            {paragraph}
                                            <br /><br />
                                        </React.Fragment>
                                    ))}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogAction>{t('settings.about.disclaimer.understood')}</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </CardContent>
        </Card>

         <Card>
            <CardHeader>
                <CardTitle className="text-lg">{t('settings.support.title')}</CardTitle>
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
                    <Button className="w-full max-w-xs rounded-full bg-gradient-to-r from-orange-500 to-red-600 text-primary-foreground dark:text-black hover:opacity-90 transition-opacity">{t('settings.logout.button')}</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>{t('settings.logout.dialog.title')}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {t('settings.logout.dialog.description')}
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={signOut}
                        className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                    >
                        {t('settings.logout.dialog.confirm')}
                    </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
        
        <Card className="border-destructive">
            <CardHeader>
                <CardTitle className="text-destructive text-lg">{t('settings.danger_zone.title')}</CardTitle>
                <CardDescription className="text-sm">{t('settings.danger_zone.description')}</CardDescription>
            </CardHeader>
            <CardContent>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="outline" className="w-full max-w-xs rounded-full border-destructive text-destructive hover:bg-destructive/10">{t('settings.danger_zone.delete_account')}</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader className="text-left">
                            <AlertDialogTitle>
                                <div className="flex items-center gap-2">
                                     <AlertTriangle className="text-destructive" /> {t('settings.danger_zone.dialog.title')}
                                </div>
                            </AlertDialogTitle>
                            <AlertDialogDescription dangerouslySetInnerHTML={{ __html: t('settings.danger_zone.dialog.description') }} />
                        </AlertDialogHeader>
                        <div className="py-2">
                            <Label htmlFor="delete-password" className="sr-only">密碼</Label>
                            <Input
                                id="delete-password"
                                type="password"
                                placeholder={t('settings.danger_zone.dialog.password_placeholder')}
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
                                {t('settings.danger_zone.dialog.confirm')}
                            </Button>
                            <AlertDialogCancel asChild>
                                <Button variant="outline" className="w-full rounded-full" onClick={() => setPassword('')}>{t('cancel')}</Button>
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
