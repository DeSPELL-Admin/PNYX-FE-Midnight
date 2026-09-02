'use client';

/**
 * 구매자 전용 데이터셋 상세 — 다운로드 → 파싱 → 온체인 커밋 대조 → 로컬 분석.
 *
 * `checkRowCommit` 이 midnight-js/compact-runtime(WASM)을 태우므로 이 컴포넌트 전체를
 * 부모 page.tsx 가 `dynamic(..., { ssr: false })` 로 로드한다(VerifyPanel 과 동일 규칙).
 *
 * 신뢰 경계: 온체인 커밋에 봉인된 값은 itemId 와 bracket 뿐이다. 이름·썸네일은 구매자 전용
 * 카탈로그(또는 v2 데이터셋의 이름 필드)에서 온 **참고 정보**이며 검증 대상이 아니다.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Download, RefreshCw, XCircle } from 'lucide-react';
import Button from '~/components/ui/Button';
import { Spinner } from '~/components/ui/Spinner';
import { useChainId } from '~/hooks/wallet';
import { marketKeys, useOrder, useOrderCatalog } from '~/hooks/market';
import { api } from '~/lib/api';
import { sha256Hex } from '~/lib/crypto/sha256';
import { checkRowCommit } from '~/lib/midnight/license';
import { analyze } from '~/lib/market/analytics';
import { namesFromRows, parseDataset } from '~/lib/market/dataset';
import BracketGrid from './BracketGrid';
import ItemThumb from './ItemThumb';
import MultiRowDashboard from './MultiRowDashboard';

const CARD = 'rounded-xl border border-brand-primary-700 bg-brand-primary-800/60 p-4';

type VerifyState =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'done'; rowOk: boolean[]; fileHash: string; hashMatch: boolean }
  | { status: 'error'; message: string };

function truncateHash(hash: string) {
  return hash.length > 20 ? `${hash.slice(0, 10)}…${hash.slice(-6)}` : hash;
}

export default function DatasetView({ orderId }: { orderId: string }) {
  const tMarket = useTranslations('market');
  const chainId = useChainId();

  const { data: order, isLoading: isOrderLoading, isError: isOrderError } = useOrder(chainId, orderId);
  const isFulfilled = order?.status === 'FULFILLED';

  // 소유자가 아니면 BE 가 403 → isError. 이름이 없을 뿐이므로 페이지 자체를 막지는 않는다.
  const { data: catalog } = useOrderCatalog(chainId, orderId, { enabled: isFulfilled });

  const datasetQuery = useQuery({
    queryKey: marketKeys.dataset(chainId, orderId),
    queryFn: async () => {
      const blob = await api.market.downloadDataset(chainId as number, orderId);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      return { blob, bytes, file: parseDataset(bytes) };
    },
    enabled: !!chainId && isFulfilled,
    staleTime: Infinity,
    retry: false,
  });

  const dataset = datasetQuery.data;
  const [verify, setVerify] = useState<VerifyState>({ status: 'idle' });

  const rows = useMemo(() => dataset?.file.rows ?? [], [dataset]);
  // 단일 로우 화면 전용 — 로우마다 브라켓 길이(16/32/64)가 다를 수 있으므로 집계에는 쓰지 않는다.
  const singleRowSize = rows.length === 1 ? rows[0].bracket.length : 0;

  const stats = useMemo(
    () => analyze(rows.map((r) => ({ itemId: r.itemId, bracket: r.bracket }))),
    [rows],
  );

  // 이름 해석 순서: v2 로우 필드 > 카탈로그 > `#<id>`.
  const nameMap = useMemo(() => {
    const names = new Map<number, string>();
    catalog?.items.forEach((item) => names.set(item.itemId, item.name));
    for (const [itemId, name] of namesFromRows(rows)) names.set(itemId, name);
    return names;
  }, [catalog, rows]);

  // 썸네일은 카탈로그에만 있다(데이터셋에는 이미지 정보가 없다).
  const imageMap = useMemo(() => {
    const images = new Map<number, string>();
    catalog?.items.forEach((item) => {
      if (item.imageName) images.set(item.itemId, item.imageName);
    });
    return images;
  }, [catalog]);

  const nameOf = useCallback((itemId: number) => nameMap.get(itemId) ?? `#${itemId}`, [nameMap]);
  const imageOf = useCallback((itemId: number) => imageMap.get(itemId), [imageMap]);

  const runVerify = useCallback(async () => {
    if (!dataset || !order) return;
    setVerify({ status: 'running' });
    try {
      const fileHash = await sha256Hex(dataset.bytes);
      const rowOk = await Promise.all(
        dataset.file.rows.map((row) =>
          checkRowCommit({
            tournamentId: row.tournamentId,
            itemId: row.itemId,
            segment: row.segment,
            salt: row.salt,
            bracket: row.bracket,
          }).catch(() => false),
        ),
      );
      setVerify({
        status: 'done',
        rowOk,
        fileHash,
        hashMatch: !!order.datasetHash && fileHash === order.datasetHash.toLowerCase(),
      });
    } catch (err) {
      setVerify({ status: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }, [dataset, order]);

  // 다운로드가 끝나면 자동으로 한 번 검증한다(같은 데이터셋에 대해 중복 실행 방지).
  const autoRunRef = useRef<string | null>(null);
  useEffect(() => {
    if (!dataset || !order) return;
    const key = `${orderId}:${dataset.bytes.byteLength}`;
    if (autoRunRef.current === key) return;
    autoRunRef.current = key;
    void runVerify();
  }, [dataset, order, orderId, runVerify]);

  const handleDownload = useCallback(() => {
    if (!dataset) return;
    const url = URL.createObjectURL(dataset.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pnyx-dataset-${orderId}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Firefox/Safari 는 click() 직후 동기 revoke 하면 저장이 취소될 수 있다 — 한 박자 늦춘다.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [dataset, orderId]);

  if (isOrderLoading || chainId === undefined) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size={28} className="text-brand-primary-400" />
      </div>
    );
  }

  if (isOrderError || !order) {
    return (
      <div className={CARD}>
        <p className="text-[13px] text-brand-primary-400">{tMarket('dataNotYours')}</p>
      </div>
    );
  }

  if (!isFulfilled) {
    return (
      <div className={`${CARD} space-y-3`}>
        <p className="text-[13px] text-brand-primary-400">{tMarket('dataNotReady')}</p>
        <Link
          href={`/market/orders/${orderId}`}
          className="inline-block rounded-lg border border-brand-primary-700 px-3 py-1.5 text-[12px] text-brand-primary-300"
        >
          {tMarket('dataBackToOrder')}
        </Link>
      </div>
    );
  }

  const totalOnChain = order.sampleAtSale ?? order.deliveredRowCount ?? rows.length;
  const passCount = verify.status === 'done' ? verify.rowOk.filter(Boolean).length : 0;
  const allRowsPass = verify.status === 'done' && rows.length > 0 && passCount === rows.length;
  const championSealed = verify.status === 'done' ? verify.rowOk[0] === true : null;

  return (
    <div className="space-y-4">
      <div className={`${CARD} space-y-3`}>
        <div className="flex items-start justify-between gap-2">
          <p className="text-[15px] font-[600] leading-tight text-white">
            {dataset?.file.tournamentTitle ??
              catalog?.tournamentTitle ??
              tMarket('dataFallbackTitle', { id: order.tournamentId })}
          </p>
          <span className="flex-shrink-0 rounded-full bg-point-green/20 px-2 py-0.5 text-[10px] font-[600] text-point-green">
            {tMarket('statusFulfilled')}
          </span>
        </div>

        <p className="text-[11px] text-brand-primary-400">
          {tMarket('dataRowsDelivered', { delivered: rows.length, total: totalOnChain })}
        </p>

        <div className="rounded-lg bg-brand-primary-900/60 p-2.5">
          {verify.status === 'running' && (
            <div className="flex items-center gap-2 text-brand-primary-400">
              <Spinner size={14} />
              <span className="text-[11px]">{tMarket('dataVerifying')}</span>
            </div>
          )}

          {verify.status === 'error' && (
            <p className="break-words text-[11px] text-red-400">
              {tMarket('dataVerifyFailed')}: {verify.message}
            </p>
          )}

          {verify.status === 'done' && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                {allRowsPass ? (
                  <CheckCircle2 size={14} className="flex-shrink-0 text-point-green" />
                ) : (
                  <XCircle size={14} className="flex-shrink-0 text-red-400" />
                )}
                <span className={`text-[11px] ${allRowsPass ? 'text-point-green' : 'text-red-400'}`}>
                  {tMarket('dataRowsMatch', { pass: passCount, total: rows.length })}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {verify.hashMatch ? (
                  <CheckCircle2 size={14} className="flex-shrink-0 text-point-green" />
                ) : (
                  <XCircle size={14} className="flex-shrink-0 text-red-400" />
                )}
                <span className={`text-[11px] ${verify.hashMatch ? 'text-point-green' : 'text-red-400'}`}>
                  {verify.hashMatch ? tMarket('dataHashMatch') : tMarket('dataHashMismatch')}
                </span>
              </div>
              {order.datasetHash && (
                <p className="pt-0.5 text-[10px] text-brand-primary-500">
                  {tMarket('dataDatasetHash')}: {truncateHash(order.datasetHash)}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            variant="ctaYellow"
            size="sm"
            fullWidth
            onClick={handleDownload}
            disabled={!dataset || datasetQuery.isLoading}
          >
            <Download size={14} className="mr-1.5" />
            {tMarket('dataDownload')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            fullWidth
            onClick={() => void runVerify()}
            disabled={!dataset || verify.status === 'running'}
          >
            <RefreshCw size={14} className="mr-1.5" />
            {tMarket('dataReverify')}
          </Button>
        </div>
      </div>

      {datasetQuery.isLoading && (
        <div className="flex items-center justify-center py-12">
          <Spinner size={24} className="text-brand-primary-400" />
        </div>
      )}

      {datasetQuery.isError && (
        <div className={CARD}>
          <p className="text-[12px] text-brand-primary-400">{tMarket('dataLoadFailed')}</p>
        </div>
      )}

      {dataset && rows.length === 0 && (
        <div className={CARD}>
          <p className="text-[12px] text-brand-primary-400">{tMarket('dataEmpty')}</p>
        </div>
      )}

      {dataset && rows.length === 1 && (
        <>
          <div className={CARD}>
            <div className="flex items-center gap-3">
              <ItemThumb
                imageName={imageOf(rows[0].bracket[0] ?? rows[0].itemId)}
                alt={nameOf(rows[0].bracket[0] ?? rows[0].itemId)}
                className="h-16 w-16"
                spinnerSize={20}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[16px] font-[700] text-white">
                  {nameOf(rows[0].bracket[0] ?? rows[0].itemId)}
                </p>
                <p className="mt-0.5 text-[11px] text-brand-primary-400">
                  {tMarket('dataRowLabel', { index: 1, size: singleRowSize })}
                </p>
                {championSealed === null ? (
                  <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-brand-primary-900 px-2 py-0.5 text-[10px] font-[600] text-brand-primary-400">
                    {tMarket('dataVerifying')}
                  </span>
                ) : (
                  <span
                    className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-[600] ${
                      championSealed ? 'bg-point-green/20 text-point-green' : 'bg-red-400/20 text-red-400'
                    }`}
                  >
                    {championSealed ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                    {championSealed ? tMarket('dataSealed') : tMarket('dataNotSealed')}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className={CARD}>
            <BracketGrid bracket={rows[0].bracket} nameOf={nameOf} />
          </div>
        </>
      )}

      {dataset && rows.length >= 2 && (
        <MultiRowDashboard
          rows={rows}
          stats={stats}
          catalogItemCount={catalog?.items.length}
          nameOf={nameOf}
          imageOf={imageOf}
          rowOk={verify.status === 'done' ? verify.rowOk : null}
        />
      )}
    </div>
  );
}
