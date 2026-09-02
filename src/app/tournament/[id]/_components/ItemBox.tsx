"use client";

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

import { Candidate } from '~/lib/api/types';

// next/image sizes — 프리로드(TournamentGame)와 실제 렌더가 동일 variant 를 받도록 공유한다.
// (값이 다르면 브라우저가 다른 variant 를 골라 프리로드 캐시가 안 맞는다.)
export const ITEM_IMAGE_SIZES = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw';

interface ItemBoxProps {
    item: Candidate;
    position: 'top' | 'bottom';
    /** 선택된(승자) 카드 여부 */
    isSelected: boolean;
    /**
     * 선택 애니메이션 단계
     * - idle  : 평소
     * - center: 선택 카드를 중앙으로 이동(비선택은 이때부터 페이드아웃)
     * - up    : 선택 카드를 위로 올리며 페이드아웃
     */
    selectPhase: 'idle' | 'center' | 'up';
    onClick: () => void;
    disabled?: boolean;
}

export default function ItemBox({
    item,
    position,
    isSelected,
    selectPhase,
    onClick,
    disabled,
}: ItemBoxProps) {
    const [imgLoaded, setImgLoaded] = useState(false);
    const imgRef = useRef<HTMLImageElement | null>(null);
    // src 가 바뀔 때: blob/캐시/프리로드로 이미 디코딩이 끝난 이미지는 onLoad(load 이벤트)가
    // 다시 발생하지 않으므로 complete 를 직접 확인한다. onLoad 하나에만 의존하면 imgLoaded 가
    // false 로 고정되어 pulse 스켈레톤이 계속 깔리는 문제가 생긴다.
    useEffect(() => {
        const el = imgRef.current;
        setImgLoaded(!!el && el.complete && el.naturalWidth > 0);
    }, [item.imageUrl]);

    const animating = selectPhase !== 'idle';

    // 선택 카드: center(중앙) → up(위로 + 페이드아웃) / 비선택 카드: 페이드아웃
    let transform = '';
    let opacity = 1;
    if (animating) {
        if (isSelected) {
            if (selectPhase === 'center') {
                transform = position === 'top' ? 'translateY(50%)' : 'translateY(-50%)';
            } else {
                transform = 'translateY(-130%)';
                opacity = 0;
            }
        } else {
            opacity = 0;
        }
    }

    // 단계별 트랜지션(중앙 이동은 짧고 탄력있게, 위로 사라짐은 길게)
    let transition = 'transform 300ms ease, opacity 300ms ease';
    if (isSelected && selectPhase === 'center') {
        transition = 'transform 250ms cubic-bezier(0.34, 1.2, 0.64, 1)';
    } else if (isSelected && selectPhase === 'up') {
        transition = 'transform 440ms ease-in, opacity 360ms ease-in';
    } else if (!isSelected && animating) {
        transition = 'opacity 300ms ease';
    }

    return (
        <div
            className={`relative cursor-pointer group w-full flex-1 overflow-hidden rounded-[15px]
                ${isSelected && animating ? 'z-50' : ''}
                ${disabled ? 'pointer-events-none' : ''}
            `}
            style={{ transform, opacity, transition, transformOrigin: 'center' }}
            onClick={onClick}
        >
            {item.imageUrl ? (
                <>
                    {!imgLoaded && <div className="absolute inset-0 bg-gray-800 animate-pulse rounded-[15px]" />}
                    <Image
                        ref={imgRef}
                        src={item.imageUrl}
                        alt={item.name}
                        fill
                        className={`object-cover rounded-[15px] transition-opacity duration-300 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
                        priority
                        sizes={ITEM_IMAGE_SIZES}
                        onLoad={() => setImgLoaded(true)}
                        onError={() => setImgLoaded(true)}
                        draggable={false}
                    />
                </>
            ) : (
                <div className="w-full h-full bg-gray-800 animate-pulse rounded-[15px]" />
            )}
            <div
                className="absolute inset-0"
                style={{
                    background: position !== 'top'
                        ? `linear-gradient(180deg, rgba(25, 25, 25, 0.50) 0%, rgba(25, 25, 25, 0.00) 100%)`
                        : `linear-gradient(180deg, rgba(25, 25, 25, 0.00) 0%, rgba(25, 25, 25, 0.50) 100%)`,
                }}
            />
            <div className={`absolute inset-0 flex p-4 ${position === 'top' ? 'items-end justify-end' : 'items-start justify-start'}`}>
                <span className={`text-white font-albert ${position === 'top' ? 'text-end' : 'text-start'} `}
                    style={{
                        WebkitTextStrokeWidth: '0.6px',
                        WebkitTextStrokeColor: '#000',
                        fontSize: '20px',
                        fontStyle: 'italic',
                        fontWeight: '700',
                        lineHeight: 'normal',
                        letterSpacing: '-0.36px',
                    }}>
                    {item.name}
                </span>
            </div>
        </div>
    );
}
