'use client';

/**
 * 검증 패널 — FULFILLED 주문의 데이터셋을 다운로드하고, 서버를 신뢰하지 않고 온체인 License 를
 * 직접 조회(license.ts 의 fetchLicense/fetchSampleCount/checkRowCommit)해 6개 항목을 대조한다.
 * midnight-js/compact-runtime(WASM) 은 license.ts 내부에서 함수 단위로 동적 import 되므로
 * 이 파일 자체는 정적 import 만 사용해도 안전하다 — 대신 부모(page.tsx)가 이 컴포넌트 전체를
 * `dynamic(..., { ssr: false })` 로 로드한다.
 */

import { useCallback, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, XCircle, Download, Upload } from 'lucide-react';
import Button from '~/components/ui/Button';
import { Spinner } from '~/components/ui/Spinner';
import { useAccount } from '~/hooks/wallet';
import { api } from '~/lib/api';
import type { MarketOrder } from '~/lib/api/market';
import { sha256Hex } from '~/lib/crypto/sha256';
import { fetchLicense, fetchSampleCount, checkRowCommit, type OnChainLicense } from '~/lib/midnight/license';

interface VerifyPanelProps {
  chainId: number;
  order: MarketOrder;
}

// datasetJson 정규형(market-dev-plan.md §1) — 로우별 재판정에 필요한 필드만 사용한다.
// B안(브라켓 완전 봉인) — bracket 은 로우 커밋 재계산에 필수. 없는 로우는 구버전 데이터셋으로 간주해
// on-chain commitment 검사를 skip 한다(옵셔널로 둔 이유).
interface DatasetRow {
  tournamentId: number;
  itemId: number;
  segment: string;
  salt: string;
  bracket?: number[];
}

interface DatasetFile {
  v: number;
  tournamentId: number;
  orderId: string;
  rowCount: number;
  rows: DatasetRow[];
}

type CheckStatus = 'pass' | 'fail' | 'skipped';

interface CheckRow {
  id: string;
  label: string;
  status: CheckStatus;
  detail?: string;
}

export default function VerifyPanel({ chainId, order }: VerifyPanelProps) {
  const tMarket = useTranslations('market');
  const { address } = useAccount();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isVerifying, setIsVerifying] = useState(false);
  const [checks, setChecks] = useState<CheckRow[] | null>(null);
  const [license, setLicense] = useState<OnChainLicense | null>(null);
  const [sampleCount, setSampleCount] = useState<number | null>(null);
  const [rowResults, setRowResults] = useState<boolean[] | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  const runVerification = useCallback(async (bytes: Uint8Array) => {
    setIsVerifying(true);
    setRunError(null);
    setChecks(null);
    setRowResults(null);

    try {
      const fileHash = await sha256Hex(bytes);

      let parsed: DatasetFile | null = null;
      try {
        parsed = JSON.parse(new TextDecoder().decode(bytes)) as DatasetFile;
      } catch {
        parsed = null;
      }
      const rows = parsed?.rows ?? [];

      // 지갑 없이도(구매자 본인이 아니어도) 온체인에서 직접 License 를 조회한다 — 서버 신뢰 불필요.
      const [fetchedLicense, currentSampleCount] = await Promise.all([
        fetchLicense({ buyerPkHex: order.buyerPk, tournamentId: order.tournamentId, querySpec: order.querySpec }),
        fetchSampleCount(order.tournamentId),
      ]);
      setLicense(fetchedLicense);
      setSampleCount(currentSampleCount);

      // B안 — bracket 없는 로우가 하나라도 있으면(구버전 데이터셋) 봉인 검증 자체가 불가능하므로 skip.
      const bracketSealSupported = rows.length > 0 && rows.every((r) => Array.isArray(r.bracket));

      let rowChecks: boolean[] = [];
      if (fetchedLicense && bracketSealSupported) {
        rowChecks = await Promise.all(
          rows.map((row) =>
            checkRowCommit({
              tournamentId: row.tournamentId,
              itemId: row.itemId,
              segment: row.segment,
              salt: row.salt,
              bracket: row.bracket as number[],
            }).catch(() => false),
          ),
        );
      }
      setRowResults(rowChecks);

      const specHash = await sha256Hex(order.querySpec);
      const buyerBindingHash = address ? await sha256Hex(address.toLowerCase()) : null;

      const results: CheckRow[] = [
        {
          id: 'integrity',
          label: tMarket('checkIntegrity'),
          status: !!order.datasetHash && fileHash === order.datasetHash.toLowerCase() ? 'pass' : 'fail',
        },
        {
          id: 'rowCount',
          label: tMarket('checkRowCount'),
          status: fetchedLicense && rows.length === fetchedLicense.rowCount ? 'pass' : 'fail',
          detail: fetchedLicense ? `${rows.length} / ${fetchedLicense.rowCount}` : tMarket('licenseNotFound'),
        },
        {
          id: 'completeness',
          label: tMarket('checkCompleteness'),
          status: !fetchedLicense
            ? 'skipped'
            : fetchedLicense.rowCount === fetchedLicense.sampleAtSale ? 'pass' : 'fail',
          detail: fetchedLicense
            ? (fetchedLicense.rowCount === fetchedLicense.sampleAtSale ? tMarket('fullDataset') : tMarket('partialDataset'))
            : undefined,
        },
        {
          id: 'specMatch',
          label: tMarket('checkSpecMatch'),
          status: fetchedLicense && specHash === fetchedLicense.querySpecHash ? 'pass' : 'fail',
        },
        {
          id: 'buyerBinding',
          label: tMarket('checkBuyerBinding'),
          status: !address
            ? 'skipped'
            : fetchedLicense && buyerBindingHash === fetchedLicense.buyerPk ? 'pass' : 'fail',
          detail: !address ? tMarket('walletNotConnected') : undefined,
        },
        {
          id: 'onChainCommit',
          label: tMarket('checkOnChainCommit'),
          status: rows.length === 0
            ? 'skipped'
            : !bracketSealSupported
              ? 'skipped'
              : rowChecks.every(Boolean) ? 'pass' : 'fail',
          detail: rows.length === 0
            ? undefined
            : !bracketSealSupported
              ? tMarket('bracketFieldMissing')
              : tMarket('rowsVerified', { pass: rowChecks.filter(Boolean).length, total: rows.length }),
        },
      ];

      setChecks(results);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsVerifying(false);
    }
  }, [address, order, tMarket]);

  // "Download & Verify" — 같은 blob 을 (a) 파일로 저장하고 (b) arrayBuffer 로 곧장 검증한다.
  const handleDownloadAndVerify = useCallback(async () => {
    setIsVerifying(true);
    setRunError(null);
    try {
      const blob = await api.market.downloadDataset(chainId, order.orderId);

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pnyx-dataset-${order.orderId}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      const buffer = await blob.arrayBuffer();
      await runVerification(new Uint8Array(buffer));
    } catch (err) {
      setIsVerifying(false);
      setRunError(err instanceof Error ? err.message : String(err));
    }
  }, [chainId, order.orderId, runVerification]);

  // "Verify a file I picked" — 임의 파일 재검증(위변조 데모).
  const handleFilePicked = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const buffer = await file.arrayBuffer();
    await runVerification(new Uint8Array(buffer));
  }, [runVerification]);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-brand-primary-700 bg-brand-primary-800/60 p-4">
      <h2 className="text-[14px] font-[600] text-white">{tMarket('verifyTitle')}</h2>

      <div className="flex flex-col gap-2">
        <Button
          variant="ctaYellow"
          size="sm"
          fullWidth
          onClick={handleDownloadAndVerify}
          isLoading={isVerifying}
          disabled={isVerifying}
        >
          <Download size={16} className="mr-1.5" />
          {tMarket('downloadAndVerify')}
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={handleFilePicked}
        />
        <Button
          variant="outline"
          size="sm"
          fullWidth
          onClick={() => fileInputRef.current?.click()}
          disabled={isVerifying}
        >
          <Upload size={16} className="mr-1.5" />
          {tMarket('verifyPicked')}
        </Button>
      </div>

      {isVerifying && (
        <div className="flex items-center justify-center gap-2 py-4 text-brand-primary-400">
          <Spinner size={16} />
          <span className="text-[12px]">{tMarket('verifying')}</span>
        </div>
      )}

      {runError && <p className="break-words text-[11px] text-red-400">{runError}</p>}

      {checks && !isVerifying && (
        <div className="flex flex-col divide-y divide-brand-primary-700/60">
          {checks.map((c) => (
            <div key={c.id} className="flex items-start justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="text-[12px] text-white">{c.label}</p>
                {c.detail && <p className="mt-0.5 text-[10px] text-brand-primary-400">{c.detail}</p>}
              </div>
              {c.status === 'pass' && <CheckCircle2 size={18} className="flex-shrink-0 text-point-green" />}
              {c.status === 'fail' && <XCircle size={18} className="flex-shrink-0 text-red-400" />}
              {c.status === 'skipped' && (
                <span className="flex-shrink-0 text-[10px] text-brand-primary-500">{tMarket('skipped')}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {rowResults && rowResults.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {rowResults.map((ok, i) => (
            <span
              key={i}
              className={`inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-[600] ${
                ok ? 'bg-point-green/20 text-point-green' : 'bg-red-400/20 text-red-400'
              }`}
              title={`row ${i}`}
            >
              {ok ? '✓' : '✕'}
            </span>
          ))}
        </div>
      )}

      {license && (
        <div className="mt-1 rounded-lg bg-brand-primary-900/60 p-2 text-[10px] text-brand-primary-400">
          <p>{tMarket('licenseRowCount', { count: license.rowCount })}</p>
          <p>{tMarket('licenseSampleAtSale', { count: license.sampleAtSale })}</p>
          {sampleCount !== null && <p>{tMarket('currentSampleCount', { count: sampleCount })}</p>}
        </div>
      )}
    </div>
  );
}
