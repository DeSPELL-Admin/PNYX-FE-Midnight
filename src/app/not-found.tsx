import { getTranslations } from 'next-intl/server';
import Button from '~/components/ui/Button';

export default async function NotFound() {
    const t = await getTranslations('notFound');
    return (
        <div className="inline-flex h-[calc(100vh-140px)] flex-col items-center justify-center text-white p-4">
            <div className="container-narrow flex flex-col items-center justify-center gap-6 text-center animate-in fade-in zoom-in duration-500">
                <h1 className="text-8xl tracking-tighter text-point-yellow select-none">404</h1>
                <div className="space-y-4">
                    <h2 className="text-2xl font-bold tracking-tight">{t('heading')}</h2>
                    <p className="text-gray-400 text-base leading-relaxed">
                        {t('body')}
                    </p>
                </div>
                <div className="pt-4">
                    <Button
                        variant='primary'
                        className="min-w-[140px] shadow-sm hover:shadow-md transition-all active:scale-95"
                        href="/"
                    >
                        {t('goHome')}
                    </Button>
                </div>
            </div>
        </div>
    );
}
