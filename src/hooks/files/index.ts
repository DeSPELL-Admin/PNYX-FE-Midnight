/**
 * Files 관련 훅
 */

'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '~/lib/api';

// Query Keys
export const fileKeys = {
  all: ['files'] as const,
  json: (originalName: string) => [...fileKeys.all, 'json', originalName] as const,
  image: (originalName: string) => [...fileKeys.all, 'image', originalName] as const,
};

/**
 * JSON 파일 다운로드 및 파싱
 */
export function useJsonFiles(originalName: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    // undefined 키로 캐시가 오염되지 않도록 빈 문자열로 정규화 (enabled 가드로 실제 호출은 차단)
    queryKey: fileKeys.json(originalName ?? ''),
    queryFn: () => api.files.getJsonFiles(originalName as string),
    enabled: !!originalName && (options?.enabled ?? true),
    staleTime: Infinity, // 파일은 변하지 않는다고 가정
  });
}

/**
 * 이미지 파일 다운로드 (URL 반환)
 *
 * Blob URL 수명을 React Query 캐시 엔트리 수명과 1:1로 묶어 누수를 막는다(H1).
 * getImageFile 은 같은 이름에 대해 Blob 을 한 번만 만들어 캐시(useImageFile + 게임
 * progressive loader 공유)에 보관한다. 해당 쿼리가 캐시에서 제거될 때(gcTime 경과 후
 * 모든 구독자가 사라진 시점) releaseImageFile 로 revoke 한다. 여러 컴포넌트가 같은
 * 이미지를 동시에 쓰는 동안은 캐시 엔트리가 살아있어 조기 revoke 되지 않는다.
 * 확장자(.webp)는 getImageFile 한 곳에서만 붙이므로 여기서는 원본 이름만 넘긴다(M13).
 */
export function useImageFile(originalName: string | undefined, options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    // undefined 키로 캐시가 오염되지 않도록 빈 문자열로 정규화 (enabled 가드로 실제 호출은 차단)
    queryKey: fileKeys.image(originalName ?? ''),
    queryFn: () => api.files.getImageFile(originalName as string),
    enabled: !!originalName && (options?.enabled ?? true),
    staleTime: Infinity,
    retry: false,
  });

  // 이 이미지 쿼리가 캐시에서 제거되면 Blob URL 을 revoke 한다.
  useEffect(() => {
    if (!originalName) return;
    const targetKey = JSON.stringify(fileKeys.image(originalName));
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (
        event.type === 'removed' &&
        JSON.stringify(event.query.queryKey) === targetKey
      ) {
        api.files.releaseImageFile(originalName);
      }
    });
    return unsubscribe;
  }, [originalName, queryClient]);

  return query;
}
