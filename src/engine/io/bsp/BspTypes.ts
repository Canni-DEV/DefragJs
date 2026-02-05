import { Vec3 } from '../../core/Math/Vec3';

export type BspLump = {
  offset: number;
  length: number;
};

export type BspHeader = {
  magic: string;
  version: number;
  lumps: BspLump[];
};

export type BspTexture = {
  name: string;
  surfaceFlags: number;
  contents: number;
};

export type BspVertex = {
  position: Vec3;
  texCoord: { x: number; y: number };
  lmCoord: { x: number; y: number };
  normal: Vec3;
  color: [number, number, number, number];
};

export type BspFace = {
  textureIndex: number;
  effectIndex: number;
  type: number;
  vertexIndex: number;
  numVertices: number;
  meshVertIndex: number;
  numMeshVerts: number;
  lmIndex: number;
  lmStart: [number, number];
  lmSize: [number, number];
  lmOrigin: Vec3;
  lmVecs: [Vec3, Vec3];
  normal: Vec3;
  size: [number, number];
};

export type BspModel = {
  mins: Vec3;
  maxs: Vec3;
  faceIndex: number;
  numFaces: number;
  brushIndex: number;
  numBrushes: number;
};

export type BspData = {
  header: BspHeader;
  entities: string;
  textures: BspTexture[];
  vertices: BspVertex[];
  meshVerts: Int32Array;
  faces: BspFace[];
  models: BspModel[];
  rawLumps: Record<string, Uint8Array>;
};

export const BSP_LUMPS = {
  ENTITIES: 0,
  TEXTURES: 1,
  PLANES: 2,
  NODES: 3,
  LEAFS: 4,
  LEAFFACES: 5,
  LEAFBRUSHES: 6,
  MODELS: 7,
  BRUSHES: 8,
  BRUSHSIDES: 9,
  VERTICES: 10,
  MESHVERTS: 11,
  EFFECTS: 12,
  FACES: 13,
  LIGHTMAPS: 14,
  LIGHTVOLS: 15,
  VISDATA: 16,
} as const;
