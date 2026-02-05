import { Vec3 } from './Vec3';

export class AABB {
  mins: Vec3;
  maxs: Vec3;

  constructor(mins = new Vec3(), maxs = new Vec3()) {
    this.mins = mins;
    this.maxs = maxs;
  }

  set(mins: Vec3, maxs: Vec3): this {
    this.mins.copy(mins);
    this.maxs.copy(maxs);
    return this;
  }

  setFromCenterExtents(center: Vec3, mins: Vec3, maxs: Vec3): this {
    this.mins.set(center.x + mins.x, center.y + mins.y, center.z + mins.z);
    this.maxs.set(center.x + maxs.x, center.y + maxs.y, center.z + maxs.z);
    return this;
  }

  expandByPoint(point: Vec3): this {
    this.mins.x = Math.min(this.mins.x, point.x);
    this.mins.y = Math.min(this.mins.y, point.y);
    this.mins.z = Math.min(this.mins.z, point.z);
    this.maxs.x = Math.max(this.maxs.x, point.x);
    this.maxs.y = Math.max(this.maxs.y, point.y);
    this.maxs.z = Math.max(this.maxs.z, point.z);
    return this;
  }

  intersects(other: AABB): boolean {
    return !(
      other.maxs.x < this.mins.x ||
      other.mins.x > this.maxs.x ||
      other.maxs.y < this.mins.y ||
      other.mins.y > this.maxs.y ||
      other.maxs.z < this.mins.z ||
      other.mins.z > this.maxs.z
    );
  }

  contains(point: Vec3): boolean {
    return (
      point.x >= this.mins.x &&
      point.x <= this.maxs.x &&
      point.y >= this.mins.y &&
      point.y <= this.maxs.y &&
      point.z >= this.mins.z &&
      point.z <= this.maxs.z
    );
  }
}
