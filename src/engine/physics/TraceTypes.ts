export const Contents = {
  EMPTY: 0,
  SOLID: 1 << 0,
  WATER: 1 << 1,
  SLIME: 1 << 2,
  LAVA: 1 << 3,
  PLAYERCLIP: 1 << 4,
  MONSTERCLIP: 1 << 5,
  BODY: 1 << 6,
  TRIGGER: 1 << 7,
} as const;

export type ContentsMask = number;

export type TraceBoxRequest = {
  start: import('../core/Math/Vec3').Vec3;
  end: import('../core/Math/Vec3').Vec3;
  mins: import('../core/Math/Vec3').Vec3;
  maxs: import('../core/Math/Vec3').Vec3;
  mask: ContentsMask;
  passEntityId?: number;
};

export type TraceResult = {
  fraction: number;
  endPos: import('../core/Math/Vec3').Vec3;
  planeNormal: import('../core/Math/Vec3').Vec3;
  startSolid: boolean;
  allSolid: boolean;
  contents?: ContentsMask;
  hitId?: number;
};
