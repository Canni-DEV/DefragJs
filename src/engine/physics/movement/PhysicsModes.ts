import { PmoveParams } from './PmoveTypes';

export type PhysicsModeId = 'VQ3' | 'CPM';

export interface PhysicsMode {
  id: PhysicsModeId;
  params: PmoveParams;
  hooks?: {
    airControl?: (ctx: unknown) => void;
  };
}
