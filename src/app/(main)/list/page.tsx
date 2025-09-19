
'use client';

import { Header } from '@/components/layout/header';
import { ListingForm } from '@/components/listing-form';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { functions } from '@/lib/firebase/client-app';
import { httpsCallable } from 'firebase/functions';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal } from 'lucide-react';

export default function ListPage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [isTesting, startTestTransition] = useTransition();
    const [testResult, setTestResult] = useState<string | null>(null);
    const [testError, setTestError] = useState<string | null>(null);


    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    const handleTestConnection = () => {
        startTestTransition(async () => {
            setTestResult(null);
            setTestError(null);
            try {
                const helloWorld = httpsCallable(functions, 'helloWorld');
                const result = await helloWorld();
                const data = result.data as { message: string };
                setTestResult(`✅ 連接成功！後端回應: ${data.message}`);
                 toast({
                    title: "✅ 連接成功！",
                    description: `後端回應: ${data.message}`,
                });
            } catch (error: any) {
                console.error("Backend connection test failed:", error);
                setTestError(`❌ 連接失敗: ${error.message} (Code: ${error.code})`);
                toast({
                    title: "❌ 連接失敗",
                    description: `${error.message} (Code: ${error.code})`,
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
                
                {/* --- DEBUGGING UI --- */}
                <Card className="bg-yellow-50 border-yellow-300 dark:bg-yellow-950 dark:border-yellow-800">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-yellow-800 dark:text-yellow-300">
                            <Terminal className="h-5 w-5" />
                            除錯工具：第一步
                        </CardTitle>
                        <CardDescription className="text-yellow-700 dark:text-yellow-400">
                            點擊下方按鈕，測試您的前端應用是否能成功連接到後端 Cloud Functions。
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button 
                            onClick={handleTestConnection} 
                            disabled={isTesting}
                            className="w-full bg-yellow-400 hover:bg-yellow-500 text-yellow-950"
                        >
                            {isTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            測試後端連接
                        </Button>
                        {testResult && (
                             <Alert className="mt-4 border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950">
                                <AlertTitle className="text-green-800 dark:text-green-300">測試成功</AlertTitle>
                                <AlertDescription className="text-green-700 dark:text-green-400">
                                    {testResult}
                                </AlertDescription>
                            </Alert>
                        )}
                        {testError && (
                             <Alert variant="destructive" className="mt-4">
                                <AlertTitle>測試失敗</AlertTitle>
                                <AlertDescription>
                                    {testError}
                                </AlertDescription>
                            </Alert>
                        )}
                    </CardContent>
                </Card>
                {/* --- END DEBUGGING UI --- */}

                <ListingForm />
            </div>
        </>
    );
}
