'use client';

/**
 * 봉인된 브라켓 하나를 라운드별 컬럼으로 펼친다.
 *
 * `bracketRounds()` 가 돌려주는 `rounds[i]` 는 그 라운드의 참가자이고 `rounds[i + 1]` 은 승자다.
 * 따라서 컬럼은 `rounds[0..length-2]`, 각 컬럼에서 다음 라운드에도 이름이 있는 아이템이 승자.
 * 16강이면 4컬럼(ROUND OF 16 / QUARTERS / SEMIS / FINAL), 32·64강이면 앞쪽 컬럼이 늘어나므로
 * 가로 스크롤 컨테이너에 담는다.
 */

import { useTranslations } from 'next-intl';
import { bracketRounds } from '~/lib/market/analytics';

interface BracketGridProps {
  bracket: number[];
  nameOf: (itemId: number) => string;
}

export default function BracketGrid({ bracket, nameOf }: BracketGridProps) {
  const tMarket = useTranslations('market');
  const rounds = bracketRounds(bracket);

  if (rounds.length < 2) return null;

  const labelFor = (participants: number) => {
    if (participants === 2) return tMarket('dataRoundFinal');
    if (participants === 4) return tMarket('dataRoundSemis');
    if (participants === 8) return tMarket('dataRoundQuarters');
    return tMarket('dataRoundOf', { count: participants });
  };

  return (
    // 16강(4열)은 390px 안에 맞추고, 32/64강(5~6열)만 가로 스크롤한다 — 디자인 캔버스와 동일.
    <div className="-mx-1 overflow-x-auto px-1">
      <div className={`flex gap-1.5 ${rounds.length - 1 > 4 ? 'min-w-max' : ''}`}>
        {rounds.slice(0, -1).map((participants, roundIndex) => {
          const winners = new Set(rounds[roundIndex + 1]);
          return (
            <div
              key={roundIndex}
              className={`flex flex-col gap-1 ${rounds.length - 1 > 4 ? 'w-[96px] flex-shrink-0' : 'min-w-0 flex-1'}`}
            >
              <p className="px-1 pb-0.5 text-[9px] font-[600] uppercase tracking-wider text-brand-primary-500">
                {labelFor(participants.length)}
              </p>
              {participants.map((itemId, cellIndex) => {
                const isWinner = winners.has(itemId);
                return (
                  <div
                    key={`${itemId}-${cellIndex}`}
                    title={nameOf(itemId)}
                    className={`truncate rounded-md px-1.5 py-1 text-[10px] leading-tight ${
                      isWinner
                        ? 'bg-point-yellow/10 text-point-yellow'
                        : 'bg-brand-primary-900/60 text-brand-primary-500'
                    }`}
                  >
                    {nameOf(itemId)}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
