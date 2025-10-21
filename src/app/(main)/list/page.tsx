
'use client';

import { Header } from '@/components/layout/header';
import { ListingForm } from '@/components/listing-form';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useTranslation } from '@/hooks/use-translation';
import { Logo } from '@/components/logo';

export default function ListPage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const { t } = useTranslation();

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    if (loading || !user) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="flex flex-col items-center justify-center gap-4">
                    <Logo className="h-16 w-16" />
                    <p className="text-muted-foreground animate-pulse">{t('loading')}</p>
                </div>
            </div>
        )
    }

    return (
        <>
            <Header title={t('header.title.list')} showUserAvatar />
            <div className="container mx-auto max-w-2xl px-4 md:px-6 py-8 space-y-8">
                <ListingForm />
            </div>
        </>
    );
}
