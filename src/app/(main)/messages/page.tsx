
'use client';

import { useState, useEffect, useTransition, useRef, useCallback } from 'react';
import { Header } from '@/components/layout/header';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, MessageCircle, Search, Bell, Trash2, CheckCircle2, Circle, Star, Package, Tag, Heart, MessageSquareQuote, PackagePlus, PackageCheck } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import type { Conversation, FullUser, SystemNotification } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { zhHK } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase/client-app';
import { collection, query, where, onSnapshot, Timestamp, doc, getDoc, orderBy, updateDoc, writeBatch, arrayUnion, increment } from 'firebase/firestore';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
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
import { useToast } from '@/hooks/use-toast';

// --- Skeletons ---

function ChatListSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center space-x-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 bg-muted rounded w-1/4" />
            <Skeleton className="h-4 bg-muted rounded w-3/4" />
            <Skeleton className="h-4 bg-muted rounded w-1/2" />
          </div>
           <Skeleton className="h-16 w-16 rounded-md" />
        </div>
      ))}
    </div>
  );
}

function NotificationSkeleton() {
    return (
        <div className="space-y-2 p-4">
            {[...Array(8)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4 p-2">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-3 w-1/4" />
                    </div>
                    <Skeleton className="h-12 w-12 rounded-md" />
                </div>
            ))}
        </div>
    );
}

// --- Constants ---

const NOTIFICATION_ICONS: { [key: string]: React.ReactNode } = {
  new_message: <MessageSquareQuote className="h-5 w-5 text-blue-500" />,
  new_favorite: <Heart className="h-5 w-5 text-red-500" />,
  item_sold_to_other: <Package className="h-5 w-5 text-muted-foreground" />,
  price_drop: <Tag className="h-5 w-5 text-green-500" />,
  new_listing_success: <PackagePlus className="h-5 w-5 text-blue-500" />,
  item_sold: <PackageCheck className="h-5 w-5 text-orange-500" />,
  new_review: <Star className="h-5 w-5 text-yellow-400" />,
};


type EnrichedConversation = Conversation & {
  otherUserDetails?: FullUser;
};

// Dedicated component to manage the indicator's state and animation.
function TabIndicator({ tabsListRef, activeTab }: { tabsListRef: React.RefObject<HTMLDivElement>, activeTab: string }) {
    const [indicatorStyle, setIndicatorStyle] = useState({
      left: '0px',
      width: '0px',
      opacity: 0,
    });
  
    const updateIndicator = useCallback(() => {
      if (tabsListRef.current) {
        const activeTabNode = tabsListRef.current.querySelector<HTMLButtonElement>(`[data-state="active"]`);
        if (activeTabNode) {
          setIndicatorStyle({
            left: `${activeTabNode.offsetLeft}px`,
            width: `${activeTabNode.offsetWidth}px`,
            opacity: 1,
          });
        }
      }
    }, [tabsListRef]);
  
    useEffect(() => {
      updateIndicator();
      const timeoutId = setTimeout(updateIndicator, 100);
      
      window.addEventListener('resize', updateIndicator);
      
      return () => {
        clearTimeout(timeoutId);
        window.removeEventListener('resize', updateIndicator);
      };
    }, [activeTab, updateIndicator]);
  
    return (
      <div
        className="absolute h-full rounded-full bg-gradient-to-r from-orange-500 to-red-600 transition-all duration-300 ease-in-out"
        style={indicatorStyle}
      />
    );
}


export default function MessagesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  // --- States for Private Messages ---
  const [conversations, setConversations] = useState<EnrichedConversation[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [errorConversations, setErrorConversations] = useState<string | null>(null);
  
  // --- States for System Notifications ---
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const [errorNotifications, setErrorNotifications] = useState<string | null>(null);

  // --- States for Management ---
  const [isManaging, setIsManaging] = useState(false);
  const [selectedConversations, setSelectedConversations] = useState<Set<string>>(new Set());
  const [isDeleting, startDeleteTransition] = useTransition();

  // --- State for Sliding Tabs ---
  const [activeTab, setActiveTab] = useState('private');
  const tabsListRef = useRef<HTMLDivElement>(null);

  // Effect for fetching conversations directly on the client
  useEffect(() => {
    if (authLoading || !user?.uid) {
        if (!authLoading) setLoadingConversations(false);
        return;
    }

    setLoadingConversations(true);
    setErrorConversations(null);

    const conversationsRef = collection(db, 'conversations');
    const q = query(
        conversationsRef, 
        where('participantIds', 'array-contains', user.uid), 
        orderBy('lastActivity', 'desc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
        if (snapshot.empty) {
            setConversations([]);
            setLoadingConversations(false);
            return;
        }

        const convosData = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as Conversation))
            .filter(convo => !convo.hiddenFor || !convo.hiddenFor.includes(user.uid!));

        const enrichedConvosPromises = convosData.map(async (convo) => {
            const otherUserId = convo.participantIds.find(pId => pId !== user.uid);
            let otherUserDetails: FullUser | undefined = undefined;

            if (otherUserId) {
                 if (convo.participantDetails && convo.participantDetails[otherUserId]) {
                    otherUserDetails = { uid: otherUserId, ...convo.participantDetails[otherUserId] } as FullUser;
                 } else {
                    try {
                        const userDoc = await getDoc(doc(db, 'users', otherUserId));
                        if (userDoc.exists()) {
                            otherUserDetails = userDoc.data() as FullUser;
                        }
                    } catch (e) {
                        console.error(`Failed to fetch user details for ${otherUserId}`, e);
                    }
                }
            }
            return { ...convo, otherUserDetails };
        });

        const enrichedConvos = await Promise.all(enrichedConvosPromises);
        setConversations(enrichedConvos);
        setLoadingConversations(false);

    }, (error) => {
        console.error("Failed to fetch conversations from Firestore:", error);
        setErrorConversations(`讀取聊天列表失敗: ${error.message}`);
        setLoadingConversations(false);
    });

    return () => unsubscribe();
    
  }, [user?.uid, authLoading]);


  // Effect for fetching notifications
  useEffect(() => {
    if (authLoading || !user?.uid) {
      if (!authLoading) setLoadingNotifications(false);
      return;
    }

    setLoadingNotifications(true);
    const notificationsRef = collection(db, 'notifications');
    const q = query(notificationsRef, where('userId', '==', user.uid), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SystemNotification));
      setNotifications(notifs);
      setLoadingNotifications(false);
      setErrorNotifications(null);
    }, (error) => {
        console.error("Error fetching notifications:", error);
        setErrorNotifications(`讀取通知失敗: ${error.message}`);
        setLoadingNotifications(false);
    });

    return () => unsubscribe();
  }, [user?.uid, authLoading]);
  
  // --- Derived State for Unread Counts ---
  const privateMessagesUnreadCount = conversations.reduce((acc, convo) => {
    return acc + (convo.unreadCounts?.[user?.uid || ''] || 0);
  }, 0);

  const systemNotificationsUnreadCount = notifications.filter(n => !n.isRead).length;


  // --- Handlers for Private Messages ---
  const handleToggleSelection = (convoId: string) => {
    setSelectedConversations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(convoId)) { newSet.delete(convoId); } else { newSet.add(convoId); }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedConversations.size === conversations.length) {
      setSelectedConversations(new Set());
    } else {
      setSelectedConversations(new Set(conversations.map(c => c.id)));
    }
  };

  const handleDeleteSelected = () => {
    if (!user?.uid || selectedConversations.size === 0) return;
    const selectionCount = selectedConversations.size;

    startDeleteTransition(async () => {
      try {
        const batch = writeBatch(db);
        selectedConversations.forEach(convoId => {
          const convoRef = doc(db, 'conversations', convoId);
          batch.update(convoRef, { hiddenFor: arrayUnion(user.uid) });
        });
        await batch.commit();
        
        // Optimistically filter the conversations from the UI
        setConversations(prev => prev.filter(c => !selectedConversations.has(c.id)));
        setSelectedConversations(new Set());
        setIsManaging(false);

        toast({
          title: "操作成功",
          description: `已成功隱藏 ${selectionCount} 個對話。`,
        });

      } catch (error: any) {
        toast({
          title: "刪除失敗",
          description: error.message || "發生未知錯誤，請稍後再試。",
          variant: "destructive",
        });
      }
    });
  };

  const handleChatClick = (convo: EnrichedConversation) => {
    if (isManaging) {
      handleToggleSelection(convo.id);
      return;
    }
    if (!user || !convo.otherUserDetails) return;
    
    // Client-side unread count update for immediate feedback
    if (convo.id && user.uid && (convo.unreadCounts?.[user.uid] || 0) > 0) {
        const convoRef = doc(db, "conversations", convo.id);
        updateDoc(convoRef, { [`unreadCounts.${user.uid}`]: 0 }).catch(err => console.warn("Could not mark chat as read:", err));
    }

    router.push(`/chat/${convo.id}`);
  };

  // --- Handlers for System Notifications ---
  const handleNotificationClick = (notification: SystemNotification) => {
    if (!notification.isRead) {
        const notifRef = doc(db, 'notifications', notification.id);
        updateDoc(notifRef, { isRead: true }).catch(e => console.error("Failed to mark as read", e));
    }
    if (notification.type === 'new_message' && notification.relatedData?.conversationId) {
        router.push(`/chat/${notification.relatedData.conversationId}`);
    } else if (notification.relatedData?.productId) {
        router.push(`/products/${notification.relatedData.productId}`);
    } else if (notification.relatedData?.actorId) {
        router.push(`/profile/${notification.relatedData.actorId}`);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user) return;
    const unreadNotifs = notifications.filter(n => !n.isRead);
    if (unreadNotifs.length === 0) return;

    const batch = writeBatch(db);
    unreadNotifs.forEach(notif => {
        const notifRef = doc(db, 'notifications', notif.id);
        batch.update(notifRef, { isRead: true });
    });
    
    await batch.commit();
  };

  // --- Shared Helpers ---
   const getFormattedTime = (timestamp: any) => {
    if (!timestamp) return '';
    try {
      const date = timestamp.seconds ? new Timestamp(timestamp.seconds, timestamp.nanoseconds).toDate() : new Date(timestamp);
      return formatDistanceToNow(date, { addSuffix: true, locale: zhHK });
    } catch (error) {
      console.error("Error formatting date:", error, "with value:", timestamp);
      return '剛剛';
    }
  };


  // --- Render Functions ---

  const renderPrivateMessages = () => {
    if (loadingConversations) return <ChatListSkeleton />;
    if (errorConversations) {
      return (
        <div className="p-4"><Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>讀取錯誤</AlertTitle><AlertDescription>{errorConversations}</AlertDescription></Alert></div>
      );
    }
    if (conversations.length === 0) {
      return (
        <div className="text-center text-muted-foreground py-16 flex flex-col items-center gap-4">
          <MessageCircle className="h-16 w-16 text-muted-foreground/50" />
          <p className="font-semibold text-lg">您還沒有任何訊息</p><p>當您開始與賣家對話時，訊息會出現在這裡。</p>
        </div>
      );
    }

    return (
      <div className="divide-y divide-border">
        {conversations.map((convo) => {
          const otherUser = convo.otherUserDetails;
          if (!otherUser) {
            // Render a placeholder or skip if user details aren't loaded yet
            return null; 
          }
          const lastMessageText = convo.lastMessage?.text || '還沒有訊息';
          const unreadCount = user?.uid ? (convo.unreadCounts?.[user.uid] || 0) : 0;
          const isUnread = unreadCount > 0;
          const isSelected = selectedConversations.has(convo.id);

          return (
            <div
              key={convo.id}
              className={cn("flex items-center gap-3 p-3 transition-colors", isManaging ? "cursor-pointer" : "hover:bg-muted/50 cursor-pointer", isSelected && "bg-primary/10")}
              onClick={() => handleChatClick(convo)}
            >
              {isManaging && (
                 <div className="flex items-center justify-center">
                  {isSelected ? (<CheckCircle2 className="h-5 w-5 text-primary" />) : (<Circle className="h-5 w-5 text-muted-foreground/50" />)}
                 </div>
              )}
              <Avatar className="h-12 w-12 flex-shrink-0">
                  <AvatarImage src={otherUser.photoURL || undefined} alt={otherUser.displayName || '用戶頭像'} />
                  <AvatarFallback>{otherUser.displayName?.charAt(0) || 'U'}</AvatarFallback>
              </Avatar>
              <div className="flex-1 truncate min-w-0">
                  <div className="flex justify-between items-center">
                    <p className={cn("text-sm truncate", isUnread ? "font-bold text-primary" : "font-semibold")}>{otherUser.displayName}</p>
                     <p className="text-xs text-muted-foreground ml-2 flex-shrink-0">{getFormattedTime(convo.lastActivity)}</p>
                  </div>
                  <div className='flex justify-between items-start'>
                     <div className='truncate pr-2'>
                        <p className={cn("text-sm truncate", isUnread ? "text-foreground font-bold" : "text-muted-foreground")}>{lastMessageText}</p>
                        <p className="text-xs text-foreground/60 truncate mt-1">Re: {convo.product.name}</p>
                     </div>
                      {!isManaging && isUnread && (
                        <div className="flex-shrink-0 h-5 w-5 bg-primary rounded-full text-primary-foreground flex items-center justify-center text-xs font-bold">{unreadCount > 9 ? '9+' : unreadCount}</div>
                      )}
                  </div>
              </div>
              <div className="relative h-12 w-12 flex-shrink-0">
                    <Image src={convo.product.image} alt={convo.product.name} fill className="object-cover rounded-md" data-ai-hint="product image" />
              </div>
            </div>
          );
        })}
      </div>
    );
  };
  
  const renderSystemNotifications = () => {
    if (loadingNotifications) return <NotificationSkeleton />;
    if (errorNotifications) {
      return (
        <div className="p-4"><Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>讀取錯誤</AlertTitle><AlertDescription>{errorNotifications}</AlertDescription></Alert></div>
      );
    }
    if (notifications.length === 0) {
      return (
        <div className="text-center text-muted-foreground py-16 flex flex-col items-center gap-4">
          <Bell className="h-16 w-16 text-muted-foreground/50" /><p className="font-semibold text-lg">這裡沒有任何通知</p><p>當有新動態時，您會在這裡收到通知。</p>
        </div>
      );
    }

    return (
      <>
        <div className="flex justify-end px-2 border-b">
            <Button variant="link" size="sm" onClick={handleMarkAllAsRead} disabled={!notifications.some(n => !n.isRead)}>全部標記為已讀</Button>
        </div>
        <div className="divide-y divide-border">
            {notifications.map((notif) => (
                <div 
                    key={notif.id}
                    className={cn("flex items-start gap-4 p-4 transition-colors cursor-pointer", !notif.isRead ? "bg-blue-500/5" : "hover:bg-muted/50")}
                    onClick={() => handleNotificationClick(notif)}
                >
                    <div className="relative flex-shrink-0 mt-1">
                        {NOTIFICATION_ICONS[notif.type] || <Bell className="h-5 w-5 text-muted-foreground" />}
                        {!notif.isRead && (<span className="absolute -top-1 -left-1 block h-2.5 w-2.5 rounded-full bg-blue-500 ring-2 ring-background"></span>)}
                    </div>
                    <div className="flex-1">
                        <p className="text-sm">{notif.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">{getFormattedTime(notif.createdAt)}</p>
                    </div>
                    {notif.relatedData?.productImage && (
                         <div className="relative h-14 w-14 flex-shrink-0">
                            <Image src={notif.relatedData.productImage} alt={notif.relatedData.productName || 'Product'} fill className="object-cover rounded-md" data-ai-hint="product image" />
                        </div>
                    )}
                </div>
            ))}
        </div>
      </>
    )
  }
  
  const ManagementFooter = () => (
    <div className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-sm border-t z-50 md:hidden">
      <div className="container mx-auto px-4 h-20 flex items-center justify-between">
        <Button variant="ghost" onClick={handleSelectAll} className="rounded-full">{selectedConversations.size === conversations.length ? '取消全選' : '全選'}</Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={selectedConversations.size === 0 || isDeleting} className="rounded-full bg-gradient-to-r from-orange-500 to-red-600 text-primary-foreground dark:text-black hover:opacity-90 transition-opacity"><Trash2 className="mr-2 h-4 w-4" />刪除 ({selectedConversations.size})</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>確定要刪除嗎？</AlertDialogTitle><AlertDialogDescription>您將會從列表中移除所選的 {selectedConversations.size} 個對話。此操作只會影響您自己的帳戶，對方仍然會看到對話。</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel className="rounded-full">取消</AlertDialogCancel><AlertDialogAction onClick={handleDeleteSelected} className="rounded-full bg-gradient-to-r from-orange-500 to-red-600 text-primary-foreground dark:text-black hover:opacity-90 transition-opacity">確認刪除</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );

  return (
    <>
      <Header title="訊息" showUserAvatar />
      <div className={cn("container mx-auto px-0 md:px-6 pt-4 pb-8", isManaging && "pb-24")}>
        <div className="flex items-center gap-2 mb-4 px-4 md:px-0">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="搜尋訊息..." className="rounded-full pl-9 bg-muted border-none h-9" />
            </div>
            <Button variant="ghost" className="text-foreground text-sm rounded-full" onClick={() => { setIsManaging(!isManaging); setSelectedConversations(new Set()); }}>{isManaging ? '取消' : '管理'}</Button>
        </div>

        <Tabs defaultValue="private" onValueChange={setActiveTab} className="w-full">
            <div className="flex justify-center mb-4">
                 <div className="relative rounded-full bg-muted/50 p-1.5 shadow-inner backdrop-blur-sm">
                    <TabsList className="relative inline-flex h-auto p-0 bg-transparent gap-1" ref={tabsListRef}>
                        <TabIndicator tabsListRef={tabsListRef} activeTab={activeTab} />
                        <TabsTrigger 
                            value="private" 
                            className="relative z-10 h-10 w-28 text-xs data-[state=active]:bg-transparent data-[state=active]:shadow-md data-[state=active]:text-primary-foreground dark:data-[state=active]:text-black rounded-full flex items-center justify-center gap-1 transition-all">
                            <MessageCircle className="h-5 w-5" /> 私人訊息
                            {privateMessagesUnreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white text-[10px] ring-2 ring-background">
                                    {privateMessagesUnreadCount > 9 ? '9+' : privateMessagesUnreadCount}
                                </span>
                            )}
                        </TabsTrigger>
                        <TabsTrigger 
                            value="system" 
                            className="relative z-10 h-10 w-28 text-xs data-[state=active]:bg-transparent data-[state=active]:shadow-md data-[state=active]:text-primary-foreground dark:data-[state=active]:text-black rounded-full flex items-center justify-center gap-1 transition-all">
                           <Bell className="h-5 w-5" /> 通知消息
                           {systemNotificationsUnreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white text-[10px] ring-2 ring-background">
                                    {systemNotificationsUnreadCount > 9 ? '9+' : systemNotificationsUnreadCount}
                                </span>
                            )}
                        </TabsTrigger>
                    </TabsList>
                 </div>
            </div>
            <TabsContent value="private" className="mt-2">
                {renderPrivateMessages()}
            </TabsContent>
            <TabsContent value="system" className="mt-2">
                {renderSystemNotifications()}
            </TabsContent>
        </Tabs>
      </div>
      {isManaging && <ManagementFooter />}
    </>
  );
}
