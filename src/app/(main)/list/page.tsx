
'use client';

import { Header } from '@/components/layout/header';
import { ListingForm } from '@/components/listing-form';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function ListPage() {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

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
                <ListingForm />
            </div>
        </>
    );
}
