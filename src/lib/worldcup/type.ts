export type ItemId = number;

export type LWState = {
  groups: ItemId[][];  // 현재 라운드 그룹
  next: ItemId[][];    // 다음 라운드 그룹
  matchCursor: number; // 지금까지 처리한 매치 개수
};