"use client";

import { PlusCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Button from '~/components/ui/Button';

export default function AddPage() {
  const t = useTranslations('add');
  return (
    <div className="flex flex-col items-center justify-center p-6 text-center h-[calc(100vh-140px)]">
      <h1 className="text-3xl text-gray-500 font-bold mb-4">{t('comingSoonHeading')}</h1>
      <p className="text-gray-500 mb-8 max-w-xs">
        {t('comingSoonDesc')}
      </p>

      <Button disabled>{t('createTournament')}</Button>
    </div>
  );
}
