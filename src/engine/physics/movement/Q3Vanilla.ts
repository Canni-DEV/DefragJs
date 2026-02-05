import { PhysicsMode } from './PhysicsModes';

export const Q3Vanilla: PhysicsMode = {
  id: 'VQ3',
  params: {
    friction: 6,
    stopSpeed: 100,
    accelerate: 10,
    airAccelerate: 1,
    gravity: 800,
    jumpVelocity: 270,
    stepSize: 18,
    overclip: 1.001,
    wishSpeed: 320,
  },
};
