'use client';

/**
 * 로우가 2개 이상일 때의 대시보드. 모든 수치는 `analyze()` 가 브라우저에서 계산한 값이다 —
 * 체인은 집계를 공개하지 않고, 검증된 입력(itemId·bracket)에서 유도만 한다.
 */

import { Fragment, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, ChevronDown, ChevronRight, X } from 'lucide-react';
import { decodeMatches, type Analytics } from '~/lib/market/analytics';
import type { DatasetRow } from '~/lib/market/dataset';
import ItemThumb from './ItemThumb';
import BracketGrid from './BracketGrid';

interface MultiRowDashboardProps {
  rows: DatasetRow[];
  stats: Analytics;
  /**
   * 카탈로그 아이템 수. 토너먼트 전체 후보 수이므로 "우승자 N명 중" 분모로 쓴다.
   * 카탈로그를 못 받았으면(비소유자·404) undefined — 로우 최대 브라켓 길이로 폴백한다.
   */
  catalogItemCount?: number;
  nameOf: (itemId: number) => string;
  imageOf: (itemId: number) => string | undefined;
  /** 로우별 온체인 커밋 대조 결과. 아직 검증 전이면 null. */
  rowOk: boolean[] | null;
}

const CARD = 'rounded-xl border border-brand-primary-700 bg-brand-primary-800/60 p-4';

function pctText(pct: number) {
  return `${Math.round(pct)}%`;
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={CARD}>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-[13px] font-[600] text-white">{title}</h2>
        {hint && <span className="flex-shrink-0 text-[10px] text-brand-primary-500">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function Kpi({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-xl border border-brand-primary-700 bg-brand-primary-800/60 p-3">
      <p className="text-[9px] font-[600] uppercase tracking-wider text-brand-primary-500">{label}</p>
      <p className="mt-1 text-[20px] font-[700] leading-none text-point-yellow">{value}</p>
      {sub && <p className="mt-1 text-[10px] text-brand-primary-400">{sub}</p>}
    </div>
  );
}

/** 가로 막대 한 줄(챔피언 점유율 / 매치 승률 공용). */
function Bar({
  name,
  imageName,
  detail,
  ratio,
  accent,
}: {
  name: string;
  imageName?: string;
  detail: string;
  /** 0..1 — 최댓값 대비 상대 길이. */
  ratio: number;
  accent: 'yellow' | 'green';
}) {
  return (
    <div className="flex items-center gap-2">
      <ItemThumb imageName={imageName} alt={name} className="h-7 w-7" spinnerSize={10} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[11px] text-white">{name}</span>
          <span className="flex-shrink-0 text-[10px] text-brand-primary-400">{detail}</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-brand-primary-900">
          <div
            className={`h-full rounded-full ${accent === 'yellow' ? 'bg-point-yellow' : 'bg-point-green'}`}
            style={{ width: `${Math.max(2, ratio * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/** 도달 횟수 셀의 농도 — JIT 안전하도록 리터럴 클래스만 고른다. */
function reachTint(value: number, max: number) {
  if (value === 0) return 'bg-brand-primary-900/40 text-brand-primary-600';
  const ratio = max > 0 ? value / max : 0;
  if (ratio > 0.66) return 'bg-point-yellow/25 text-point-yellow';
  if (ratio > 0.33) return 'bg-point-yellow/15 text-point-yellow';
  return 'bg-point-yellow/10 text-brand-primary-300';
}

export default function MultiRowDashboard({
  rows,
  stats,
  catalogItemCount,
  nameOf,
  imageOf,
  rowOk,
}: MultiRowDashboardProps) {
  const tMarket = useTranslations('market');
  const [showAllWinRate, setShowAllWinRate] = useState(false);
  const [showAllRows, setShowAllRows] = useState(false);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  // 로우별 우승자 / 결승 상대 — 브라켓에서 곧장 복원한다.
  const rowSummaries = useMemo(
    () =>
      rows.map((row) => {
        const matches = decodeMatches(row.bracket);
        const final = matches[matches.length - 1];
        return {
          champion: row.bracket.length > 0 ? row.bracket[0] : row.itemId,
          runnerUp: final ? final.loser : null,
        };
      }),
    [rows],
  );

  // 한 데이터셋 안에 16/32/64 브라켓이 섞일 수 있다(투표자마다 라운드 수를 직접 고른다).
  // 그래서 KPI 는 로우들의 실제 길이에서 유도하고, 라운드 표는 참가자 수만 키로 쓴다.
  const sizeStats = useMemo(() => {
    const lengths = rows.map((r) => r.bracket.length).filter((len) => len > 0);
    const unique = new Set(lengths);
    const matchesPerVote =
      lengths.length > 0
        ? lengths.reduce((sum, len) => sum + (len - 1), 0) / lengths.length
        : 0;
    return {
      uniform: unique.size === 1,
      maxLength: lengths.length > 0 ? Math.max(...lengths) : 0,
      matchesPerVote,
    };
  }, [rows]);

  // 후보 총원: 카탈로그가 있으면 그 수, 없으면 로우 중 가장 큰 브라켓 길이.
  const championsTotal = catalogItemCount ?? sizeStats.maxLength;

  const maxChampion = stats.championShare[0]?.count ?? 1;
  const winRateShown = showAllWinRate ? stats.winRate : stats.winRate.slice(0, 6);
  const headToHeadItems = stats.winRate.slice(0, 4).map((w) => w.itemId);
  const reachRows = stats.roundReach.slice(0, 6);
  // `stats.roundReach[].reached` 의 키는 라운드 참가자 수다 — 브라켓 길이와 무관하다.
  const reachColumns = [
    { key: 'qf', label: tMarket('dataColQuarters'), participants: 8 },
    { key: 'sf', label: tMarket('dataColSemis'), participants: 4 },
    { key: 'final', label: tMarket('dataColFinal'), participants: 2 },
  ];
  const visibleRows = showAllRows ? rows : rows.slice(0, 5);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Kpi label={tMarket('dataKpiVotes')} value={stats.votes} />
        <Kpi
          label={tMarket('dataKpiMatches')}
          value={stats.matchesTotal}
          sub={
            sizeStats.matchesPerVote > 0
              ? sizeStats.uniform
                ? tMarket('dataKpiMatchesPerVote', { count: Math.round(sizeStats.matchesPerVote) })
                : tMarket('dataKpiMatchesPerVoteAvg', { count: Math.round(sizeStats.matchesPerVote) })
              : undefined
          }
        />
        <Kpi
          label={tMarket('dataKpiChampions')}
          value={stats.championShare.length}
          sub={
            championsTotal > 0 ? tMarket('dataKpiChampionsOf', { total: championsTotal }) : undefined
          }
        />
      </div>

      <Section title={tMarket('dataChampionShare')}>
        <div className="space-y-2.5">
          {stats.championShare.map((c) => (
            <Bar
              key={c.itemId}
              name={nameOf(c.itemId)}
              imageName={imageOf(c.itemId)}
              detail={`${c.count} · ${pctText(c.pct)}`}
              ratio={c.count / maxChampion}
              accent="yellow"
            />
          ))}
        </div>
      </Section>

      <Section title={tMarket('dataWinRate')}>
        <div className="space-y-2.5">
          {winRateShown.map((w) => (
            <Bar
              key={w.itemId}
              name={nameOf(w.itemId)}
              imageName={imageOf(w.itemId)}
              detail={tMarket('dataWinRateDetail', {
                wins: w.wins,
                played: w.played,
                pct: pctText(w.pct),
              })}
              ratio={w.pct / 100}
              accent="green"
            />
          ))}
        </div>
        {stats.winRate.length > 6 && (
          <button
            type="button"
            onClick={() => setShowAllWinRate((v) => !v)}
            className="mt-3 w-full rounded-lg border border-brand-primary-700 py-1.5 text-[11px] text-brand-primary-300"
          >
            {showAllWinRate ? tMarket('dataShowLess') : tMarket('dataShowAll')}
          </button>
        )}
      </Section>

      {headToHeadItems.length >= 2 && (
        <Section
          title={tMarket('dataHeadToHead')}
          hint={tMarket('dataHeadToHeadHint', { count: headToHeadItems.length })}
        >
          <div className="-mx-1 overflow-x-auto px-1">
            <div className="grid min-w-max grid-cols-[84px_repeat(4,52px)] gap-1 text-[10px]">
              <div />
              {headToHeadItems.map((itemId) => (
                <div
                  key={`head-${itemId}`}
                  title={nameOf(itemId)}
                  className="truncate px-0.5 text-center text-brand-primary-500"
                >
                  {nameOf(itemId)}
                </div>
              ))}
              {headToHeadItems.map((rowId) => (
                <Fragment key={`row-${rowId}`}>
                  <div title={nameOf(rowId)} className="truncate self-center text-brand-primary-400">
                    {nameOf(rowId)}
                  </div>
                  {headToHeadItems.map((colId) => {
                    if (rowId === colId) {
                      return (
                        <div
                          key={colId}
                          className="rounded bg-brand-primary-900/40 py-1 text-center text-brand-primary-600"
                        >
                          —
                        </div>
                      );
                    }
                    const cell = stats.headToHead.get(rowId)?.get(colId);
                    if (!cell) {
                      return (
                        <div
                          key={colId}
                          className="rounded bg-brand-primary-900/30 py-1 text-center text-brand-primary-600"
                        >
                          ·
                        </div>
                      );
                    }
                    return (
                      <div
                        key={colId}
                        className={`rounded py-1 text-center ${
                          cell.w >= cell.l
                            ? 'bg-point-green/15 text-point-green'
                            : 'bg-brand-primary-900/60 text-brand-primary-400'
                        }`}
                      >
                        {cell.w}–{cell.l}
                      </div>
                    );
                  })}
                </Fragment>
              ))}
            </div>
          </div>
        </Section>
      )}

      {stats.commonFinals.length > 0 && (
        <Section title={tMarket('dataCommonFinals')}>
          <div className="divide-y divide-brand-primary-700/60">
            {stats.commonFinals.slice(0, 5).map((f) => (
              <div key={`${f.a}-${f.b}`} className="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded bg-brand-primary-900 text-[10px] font-[600] text-point-yellow">
                    {f.count}
                  </span>
                  <span className="truncate text-[11px] text-white">
                    {tMarket('dataFinalsVs', { a: nameOf(f.a), b: nameOf(f.b) })}
                  </span>
                </div>
                <span className="flex-shrink-0 text-[10px] text-brand-primary-400">
                  {tMarket('dataFinalsScore', {
                    name: nameOf(f.a),
                    w: f.aWins,
                    l: f.count - f.aWins,
                  })}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {reachRows.length > 0 && (
        <Section title={tMarket('dataRoundReach')}>
          <div className="-mx-1 overflow-x-auto px-1">
            <div className="grid min-w-max grid-cols-[104px_repeat(4,44px)] gap-1 text-[10px]">
              <div />
              {reachColumns.map((c) => (
                <div key={c.key} className="text-center font-[600] uppercase tracking-wider text-brand-primary-500">
                  {c.label}
                </div>
              ))}
              <div className="text-center font-[600] uppercase tracking-wider text-brand-primary-500">
                {tMarket('dataColWon')}
              </div>

              {reachRows.map((r) => (
                <Fragment key={r.itemId}>
                  <div title={nameOf(r.itemId)} className="truncate self-center text-brand-primary-300">
                    {nameOf(r.itemId)}
                  </div>
                  {reachColumns.map((c) => {
                    const value = r.reached[c.participants] ?? 0;
                    return (
                      <div key={c.key} className={`rounded py-1 text-center ${reachTint(value, stats.votes)}`}>
                        {value}
                      </div>
                    );
                  })}
                  <div className={`rounded py-1 text-center ${reachTint(r.won, stats.votes)}`}>{r.won}</div>
                </Fragment>
              ))}
            </div>
          </div>
        </Section>
      )}

      <Section title={tMarket('dataRowsList')}>
        <div className="divide-y divide-brand-primary-700/60">
          {visibleRows.map((row, index) => {
            const summary = rowSummaries[index];
            const isOpen = expandedRow === index;
            const ok = rowOk ? rowOk[index] : undefined;
            return (
              <div key={`${row.salt}-${index}`} className="py-2 first:pt-0 last:pb-0">
                <button
                  type="button"
                  onClick={() => setExpandedRow(isOpen ? null : index)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center gap-2 text-left"
                >
                  <span className="w-5 flex-shrink-0 text-[10px] text-brand-primary-500">#{index + 1}</span>
                  <ItemThumb
                    imageName={imageOf(summary.champion)}
                    alt={nameOf(summary.champion)}
                    className="h-7 w-7"
                    spinnerSize={10}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] text-white">{nameOf(summary.champion)}</span>
                    {summary.runnerUp !== null && (
                      <span className="block truncate text-[10px] text-brand-primary-500">
                        {tMarket('dataFinalVs', { name: nameOf(summary.runnerUp) })}
                      </span>
                    )}
                  </span>
                  {ok === true && <Check size={14} className="flex-shrink-0 text-point-green" />}
                  {ok === false && <X size={14} className="flex-shrink-0 text-red-400" />}
                  {isOpen ? (
                    <ChevronDown size={14} className="flex-shrink-0 text-brand-primary-500" />
                  ) : (
                    <ChevronRight size={14} className="flex-shrink-0 text-brand-primary-500" />
                  )}
                </button>

                {isOpen && (
                  <div className="mt-2">
                    <BracketGrid bracket={row.bracket} nameOf={nameOf} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {rows.length > 5 && !showAllRows && (
          <button
            type="button"
            onClick={() => setShowAllRows(true)}
            className="mt-3 w-full rounded-lg border border-brand-primary-700 py-1.5 text-[11px] text-brand-primary-300"
          >
            {tMarket('dataRowsShowAll', { count: rows.length })}
          </button>
        )}
      </Section>

      <div className="rounded-xl border border-brand-primary-700 bg-brand-primary-900/40 p-3">
        <p className="text-[10px] leading-relaxed text-brand-primary-400">
          {tMarket('dataFooter', { count: stats.votes })}
        </p>
        <p className="mt-1 text-[10px] leading-relaxed text-brand-primary-500">{tMarket('dataFooterVerified')}</p>
      </div>
    </div>
  );
}
