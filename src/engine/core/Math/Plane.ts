import { Vec3 } from './Vec3';

export class Plane {
  normal: Vec3;
  dist: number;

  constructor(normal = new Vec3(0, 0, 1), dist = 0) {
    this.normal = normal;
    this.dist = dist;
  }

  set(normal: Vec3, dist: number): this {
    this.normal.copy(normal);
    this.dist = dist;
    return this;
  }

  distanceToPoint(p: Vec3): number {
    return this.normal.dot(p) - this.dist;
  }
}
