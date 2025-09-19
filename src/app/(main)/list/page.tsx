
'use client';

import { Header } from '@/components/layout/header';
import { ListingForm } from '@/components/listing-form';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2, Zap } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase/client-app';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';


export default function ListPage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [isTesting, setIsTesting] = useState(false);

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);
    
    const handleTestConnection = async () => {
        setIsTesting(true);
        try {
            const helloWorld = httpsCallable(functions, 'helloWorld');
            const result = await helloWorld();
            const data = result.data as { message: string };
            toast({
                title: "✅ 連接成功！",
                description: `後端回應: ${data.message}`,
                className: "bg-green-100 dark:bg-green-800"
            });
        } catch (error: any) {
            console.error("Error calling helloWorld function:", error);
            toast({
                title: "❌ 連接失敗",
                description: `錯誤: ${error.message} (Code: ${error.code})`,
                variant: "destructive"
            });
        } finally {
            setIsTesting(false);
        }
    };

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
                
                {/* --- Debugging Card --- */}
                <Card className="border-yellow-500 border-2 bg-yellow-50 dark:bg-yellow-900/20">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-yellow-600" />除錯工具</CardTitle>
                        <CardDescription>第一步：驗證前端與後端 Cloud Functions 的基本連接是否正常。</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={handleTestConnection} disabled={isTesting} className="w-full">
                            {isTesting ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Zap className="mr-2 h-4 w-4" />
                            )}
                            測試後端連接
                        </Button>
                    </CardContent>
                </Card>

                <ListingForm />
            </div>
        </>
    );
}
