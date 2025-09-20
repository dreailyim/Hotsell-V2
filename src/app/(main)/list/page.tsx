
'use client';

import { Header } from '@/components/layout/header';
import { ListingForm } from '@/components/listing-form';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useTransition } from 'react';
import { Loader2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function ListPage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    const handleTestBackend = () => {
        startTransition(async () => {
            try {
                const functions = getFunctions();
                const helloWorld = httpsCallable(functions, 'helloWorld');
                const result = await helloWorld();
                const message = (result.data as any).message;
                toast({
                    title: '後端連接成功！',
                    description: `收到的訊息: "${message}"`,
                    className: "bg-green-100 dark:bg-green-800",
                });
            } catch (error: any) {
                console.error("Error calling helloWorld function:", error);
                toast({
                    title: '後端連接失敗',
                    description: `錯誤: ${error.message} (代碼: ${error.code})`,
                    variant: 'destructive',
                });
            }
        });
    }

    if (loading || !user) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        )
    }

    return (
        <>
            <Header title="刊登物品" showUserAvatar />
            <div className="container mx-auto max-w-2xl px-4 md:px-6 py-8 space-y-8">
                <Alert className="border-yellow-500/50 text-yellow-600 dark:text-yellow-400 [&>svg]:text-yellow-500">
                    <Zap className="h-4 w-4" />
                    <AlertTitle>開發者工具</AlertTitle>
                    <AlertDescription className="flex items-center justify-between">
                        <p>用於驗證後端服務是否正常運作。</p>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleTestBackend}
                            disabled={isPending}
                            className="border-yellow-500/50 hover:bg-yellow-500/10"
                        >
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            測試後端連接
                        </Button>
                    </AlertDescription>
                </Alert>

                <ListingForm />
            </div>
        </>
    );
}
