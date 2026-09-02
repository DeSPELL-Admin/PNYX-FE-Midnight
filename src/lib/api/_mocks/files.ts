const MOCK_IMAGE_MAP: Record<string, string> = {
  'mock-1': '/images/banner/1_superstar.webp',
  'mock-2': '/images/banner/2_redbutton.webp',
  'mock-3': '/images/banner/3_rewind.jpg',
  'mock-4': '/images/banner/1_superstar.webp',
  'mock-5': '/images/banner/2_redbutton.webp',
  'mock-6': '/images/banner/3_rewind.jpg',
  'mock-7': '/images/banner/1_superstar.webp',
  'mock-8': '/images/banner/2_redbutton.webp',
  'mock-9': '/images/banner/3_rewind.jpg',
  'mock-10': '/images/banner/1_superstar.webp',
};

export function mockGetImageFile(originalNameWithExt: string): Promise<string> {
  return Promise.resolve(mockImageUrl(originalNameWithExt));
}

// 동기 버전 — buildImageUrl 처럼 Blob 다운로드 없이 즉시 URL 이 필요한 경로에서 쓴다.
export function mockImageUrl(originalNameWithExt: string): string {
  const base = originalNameWithExt.replace(/\.(webp|jpg|jpeg|png)$/i, '');
  // 매핑 없는 mock 키는 빈 문자열 → 폴백(스피너/스켈레톤)을 보여 준다.
  return MOCK_IMAGE_MAP[base] ?? '';
}

export function mockGetJsonFiles(_originalName: string): Promise<{ key: string; value: string }[]> {
  return Promise.resolve([]);
}
