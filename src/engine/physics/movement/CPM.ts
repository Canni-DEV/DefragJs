import { PhysicsMode } from './PhysicsModes';

export const CPM: PhysicsMode = {
  id: 'CPM',
  params: {
    friction: 5,
    stopSpeed: 100,
    accelerate: 15,
    airAccelerate: 1,
    airSpeedCap: 0,
    airControl: 0,
    strafeAccelerate: 70,
    gravity: 800,
    jumpVelocity: 270,
    stepSize: 18,
    overclip: 1.001,
    wishSpeed: 320,
    duckScale: 0.5,
    rampBoost: 1,
  },
};
