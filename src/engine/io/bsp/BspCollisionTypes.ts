import { Vec3 } from '../../core/Math/Vec3';

export type BspPlane = {
  normal: Vec3;
  dist: number;
  type: number;
};

export type BspNode = {
  planeIndex: number;
  children: [number, number];
  mins: [number, number, number];
  maxs: [number, number, number];
};

export type BspLeaf = {
  cluster: number;
  area: number;
  mins: [number, number, number];
  maxs: [number, number, number];
  leafFace: number;
  numLeafFaces: number;
  leafBrush: number;
  numLeafBrushes: number;
};

export type BspBrush = {
  brushSide: number;
  numSides: number;
  textureIndex: number;
};

export type BspBrushSide = {
  planeNum: number;
  textureIndex: number;
};

export type BspCollisionData = {
  planes: BspPlane[];
  nodes: BspNode[];
  leafs: BspLeaf[];
  leafBrushes: Int32Array;
  brushes: BspBrush[];
  brushSides: BspBrushSide[];
};
