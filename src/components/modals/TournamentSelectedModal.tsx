"use client";

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Modal from '~/components/ui/Modal';
import Button from '~/components/ui/Button';
import ItemImage from '~/components/ui/ItemImage';
import { useRouter } from 'next/navigation';
import { History } from 'lucide-react';
/* import { useTournament } from '~/context/TournamentContext'; */
import { Tournament } from '~/lib/api/types';
import { useImageFile } from '~/hooks';
import { useAccount, useChainId } from '~/hooks/wallet';
import { loadGameProgress, removeGameProgress } from '~/lib/game-progress';

interface WorldcupSelectedModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournament: Tournament | null;
  onStart?: () => void;
}

export default function WorldcupSelectedModal({ isOpen, onClose, tournament, onStart }: WorldcupSelectedModalProps) {
  const router = useRouter();
  const tModal = useTranslations('modal');
  const tCommon = useTranslations('common');
  const [selectedRound, setSelectedRound] = useState(64);
  // "새로 시작" 확인 단계 — 저장본이 있을 때 1차 탭에서 바로 폐기하지 않고 확인을 받는다.
  // (실수로 제출 대기 중인 완료 게임을 날리거나, 재서빙으로 서버 셋을 덮어써 버리는 것 방지)
  const [confirmingRestart, setConfirmingRestart] = useState(false);

  /* const { startTournament } = useTournament(); // Context deprecated for game start */

  const { data: imageUrl1 } = useImageFile(tournament?.firstItemImageName);
  const { data: imageUrl2 } = useImageFile(tournament?.secondItemImageName);

  const chainId = useChainId();
  const { address } = useAccount();

  // 모달이 열릴 때 이 토너먼트의 저장된 진행 게임을 읽는다(localStorage, 클라이언트 전용).
  // 저장본이 있으면 라운드와 무관하게 상단 '이어하기' 카드를 띄우고, 없으면 기존 새 게임 모달 그대로.
  const saved = useMemo(
    () => (isOpen && tournament ? loadGameProgress(address, chainId, tournament.tournamentId) : null),
    [isOpen, tournament, address, chainId],
  );

  // 게임 페이지로 이동. 저장본이 있으면 useGameLogic 이 자동 복원, 없으면 새 게임을 시작한다.
  const goToGame = useCallback((round: number) => {
    if (!tournament) return;
    router.push(`/tournament/${tournament.tournamentId}?round=${round}`);
    if (onStart) onStart();
    onClose();
  }, [tournament, router, onStart, onClose]);

  // "이어하기" — 저장본을 유지한 채 저장된 라운드로 진입해 자동 복원한다(라운드 파라미터는 복원 시 무시).
  const handleResume = useCallback(() => {
    if (!saved) return;
    goToGame(saved.totalRound);
  }, [saved, goToGame]);

  // 모달을 닫으면 확인 단계를 초기화한다(다음에 열 때 경고부터 다시 시작).
  useEffect(() => {
    if (!isOpen) setConfirmingRestart(false);
  }, [isOpen]);

  // "새로 시작"/START — 저장본이 있으면 삭제(기존 진행 폐기) 후 고른 라운드로 새 게임을 시작한다.
  // 저장본이 있으면 1차 탭에서는 곧바로 폐기하지 않고 확인 단계를 띄운다(재확인 후에만 폐기).
  const handleStartNew = useCallback(() => {
    if (!tournament) return;
    if (saved && !confirmingRestart) {
      setConfirmingRestart(true);
      return;
    }
    if (saved) removeGameProgress(address, chainId, tournament.tournamentId);
    goToGame(selectedRound);
  }, [tournament, saved, confirmingRestart, address, chainId, selectedRound, goToGame]);

  if (!tournament) return null;

  // 완료(이미 첫 포인트 지급)된 토너먼트는 추가 적립이 없으므로 Earn Point 표기/안내를 숨긴다.
  // (Figma: 미완료=27:5406 → 표기, completed=32:5960 → 표기 없음)
  const isCompleted = tournament.status === 'completed';

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="flex flex-col gap-4">
        {/* 좌/우 대표 이미지 */}
        <div className="relative w-full h-36 rounded-xl overflow-hidden">
          <div className="grid grid-cols-2 w-full h-full">
            <div className="relative w-full h-full">
              <ItemImage src={imageUrl1} alt={tournament.title} spinnerSize={24} />
            </div>
            <div className="relative w-full h-full">
              <ItemImage src={imageUrl2} alt={tournament.title} spinnerSize={24} />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-xl ">{tournament.title}</h3>
        </div>

        {/* 진행 중인 저장 게임이 있으면 상단에 이어하기 카드 — 라운드와 무관하게 항상 노출(이어하기 우선) */}
        {saved && (
          <div className="flex flex-col gap-3 rounded-xl border border-brand-primary-600/40 bg-brand-primary-800/60 p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-point-yellow">
              <History className="h-4 w-4 shrink-0" />
              <span>
                {saved.status === 'finished'
                  ? tModal('resumeFinished')
                  : tModal('resumeInProgress', { round: saved.round })}
              </span>
            </div>
            <Button variant="ctaYellow" fullWidth onClick={handleResume}>
              {tModal('resumeSaved', { round: saved.totalRound })}
            </Button>
          </div>
        )}

        {/* 새 게임 영역 — 저장본이 있으면 '또는 새로 시작' 구분선 라벨을 보여 준다. */}
        {saved && (
          <div className="flex items-center gap-3 text-xs font-medium text-brand-primary-300">
            <span className="h-px flex-1 bg-brand-primary-600/40" />
            {tModal('orStartNew')}
            <span className="h-px flex-1 bg-brand-primary-600/40" />
          </div>
        )}

        {/* Round Selection */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-400">{tModal('round')}</span>
          {/* 선택한 라운드 = 적립 포인트(itemCount). completed 면 숨김(디자인 32:5960). */}
          {!isCompleted && (
            <span className="text-xs font-medium text-point-yellow">
              {tModal('earnPoint', { point: selectedRound })}
            </span>
          )}
        </div>
        <div className="bg-brand-primary-700/60 border border-brand-primary-600/30 p-3 rounded-lg flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-2">
            {[16, 32, 64].map((round) => (
              <div key={round} className="flex w-full justify-center items-center">
                <button
                  key={round}
                  onClick={() => setSelectedRound(round)}
                  className={`py-2 w-[60px] text-sm font-semibold rounded-lg transition-all ${selectedRound === round
                    ? 'bg-point-yellow text-brand-primary-900 '
                    : 'bg-brand-primary-800 text-white hover:bg-point-yellow hover:text-brand-primary-900'
                    }`}
                >
                  {round}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 최초 1회만 적립 안내. completed 면 숨김(디자인 32:5960 — 해당 문구 없음). */}
        {!isCompleted && (
          <p className="text-xs font-medium text-point-yellow">
            {tModal('pointFirstEntryNote')}
          </p>
        )}

        {/* 저장본이 있으면 새 게임은 기존 진행을 폐기한다는 안내 + dark-safe outline 버튼, 없으면 기본 START */}
        {saved ? (
          confirmingRestart ? (
            // 확인 단계 — 완료(제출 대기) 게임이면 더 강한 문구로 경고한다.
            <div className="flex flex-col gap-2 animate-in fade-in duration-150">
              <p className="text-xs text-point-yellow">
                {saved.status === 'finished'
                  ? tModal('restartConfirmFinished')
                  : tModal('restartConfirmInProgress')}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmingRestart(false)}
                  className="flex-1 rounded-[15px] border border-brand-primary-500 px-6 py-2 text-[16px] font-[600] text-white transition-colors hover:bg-brand-primary-700"
                >
                  {tCommon('cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleStartNew}
                  className="flex-1 rounded-[15px] border border-red-500/60 bg-red-500/10 px-6 py-2 text-[16px] font-[600] text-red-200 transition-colors hover:bg-red-500/20"
                >
                  {tModal('restartConfirmCta')}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-brand-primary-300">{tModal('restartDiscardNote')}</p>
              <button
                type="button"
                onClick={handleStartNew}
                className="w-full rounded-[15px] border border-brand-primary-500 px-6 py-2 text-[16px] font-[600] text-white transition-colors hover:bg-brand-primary-700"
              >
                {tModal('restartFresh', { round: selectedRound })}
              </button>
            </div>
          )
        ) : (
          <div className="flex gap-3 justify-center">
            <Button variant="ctaBlack" className="" onClick={handleStartNew}>
              {tCommon('start')}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
