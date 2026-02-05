import { PhysicsMode } from './PhysicsModes';

export const CPM: PhysicsMode = {
  id: 'CPM',
  params: {
    friction: 5,
    stopSpeed: 100,
    accelerate: 15,
    airAccelerate: 1.5,
    gravity: 800,
    jumpVelocity: 270,
    stepSize: 18,
    overclip: 1.001,
    wishSpeed: 320,
  },
};
