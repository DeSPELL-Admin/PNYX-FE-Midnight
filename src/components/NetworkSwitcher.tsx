"use client";

/**
 * 네트워크 패널 (Midnight)
 * Midnight 는 단일 네트워크(빌드 시 NEXT_PUBLIC_MIDNIGHT_NETWORK 로 고정)라 전환 UI 는 없다.
 * 대신 연결 지갑/네트워크/컨트랙트 정보를 보여 준다. mypage 와 NetworkGate 가 그대로 사용.
 */

import { Check, Wifi } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMidnight } from '~/components/providers/MidnightProvider';
import { MIDNIGHT_CHAIN } from '~/lib/chains';
import { TOURNAMENT_FINALIZER_ADDRESS } from '~/lib/midnight/config';

const short = (s: string | undefined, n = 8) => (s ? `${s.slice(0, n)}…${s.slice(-6)}` : '—');

export default function NetworkSwitcher() {
    const t = useTranslations('network');
    const { isConnected, address, wallet } = useMidnight();
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);
    if (!mounted) return null;

    if (!isConnected) {
        return <div className="p-4 text-center text-brand-primary-300">{t('connectFirst')}</div>;
    }

    return (
        <div className="p-4 text-white">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Wifi size={20} />
                {t('selectNetwork')}
            </h3>
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between p-3 rounded-xl border bg-point-yellow/80 border-point-yellow text-brand-primary-950">
                    <span className="font-medium">{MIDNIGHT_CHAIN.name}</span>
                    <Check size={18} />
                </div>
                <dl className="text-xs text-brand-primary-200 space-y-1 px-1 pt-2 break-all">
                    <div className="flex justify-between gap-3"><dt>{t('wallet')}</dt><dd>{wallet?.walletName ?? '—'}</dd></div>
                    <div className="flex justify-between gap-3"><dt>{t('address')}</dt><dd>{short(address, 14)}</dd></div>
                    <div className="flex justify-between gap-3"><dt>{t('contract')}</dt><dd>{short(TOURNAMENT_FINALIZER_ADDRESS)}</dd></div>
                </dl>
            </div>
        </div>
    );
}
