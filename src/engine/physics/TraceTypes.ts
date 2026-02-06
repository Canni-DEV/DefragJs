// Quake 3 contents flags (subset).
export const Contents = {
  EMPTY: 0,
  SOLID: 1,
  LAVA: 8,
  SLIME: 16,
  WATER: 32,
  PLAYERCLIP: 0x10000,
  MONSTERCLIP: 0x20000,
  BODY: 0x2000000,
  TRIGGER: 0x40000000,
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
