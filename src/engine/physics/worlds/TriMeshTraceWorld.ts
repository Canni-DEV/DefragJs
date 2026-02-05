import { Vec3 } from '../../core/Math/Vec3';
import { AABB } from '../../core/Math/AABB';
import { BspData } from '../../io/bsp/BspTypes';
import { FaceTriangulator } from '../../render/Geometry/FaceTriangulator';
import { ITraceWorld } from '../ITraceWorld';
import { TraceBoxRequest, TraceResult, Contents } from '../TraceTypes';

type Triangle = {
  a: Vec3;
  b: Vec3;
  c: Vec3;
  normal: Vec3;
  bounds: AABB;
};

export class TriMeshTraceWorld implements ITraceWorld {
  private triangles: Triangle[] = [];
  private bounds: AABB = new AABB(new Vec3(), new Vec3());
  private steps = 16;

  static fromBsp(bsp: BspData, patchSubdiv = 4): TriMeshTraceWorld {
    const world = new TriMeshTraceWorld();
    world.buildFromBsp(bsp, patchSubdiv);
    return world;
  }

  private buildFromBsp(bsp: BspData, patchSubdiv: number): void {
    const batches = FaceTriangulator.buildBatches(bsp, patchSubdiv);
    const tris: Triangle[] = [];
    const globalMin = new Vec3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
    const globalMax = new Vec3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);

    for (const batch of batches) {
      const positions = batch.positions;
      const indices = batch.indices;
      for (let i = 0; i < indices.length; i += 3) {
        const ia = indices[i] * 3;
        const ib = indices[i + 1] * 3;
        const ic = indices[i + 2] * 3;
        const a = new Vec3(positions[ia], positions[ia + 1], positions[ia + 2]);
        const b = new Vec3(positions[ib], positions[ib + 1], positions[ib + 2]);
        const c = new Vec3(positions[ic], positions[ic + 1], positions[ic + 2]);
        const normal = Vec3.sub(new Vec3(), b, a).cross(Vec3.sub(new Vec3(), c, a)).normalize();
        const triMin = new Vec3(
          Math.min(a.x, b.x, c.x),
          Math.min(a.y, b.y, c.y),
          Math.min(a.z, b.z, c.z)
        );
        const triMax = new Vec3(
          Math.max(a.x, b.x, c.x),
          Math.max(a.y, b.y, c.y),
          Math.max(a.z, b.z, c.z)
        );
        globalMin.x = Math.min(globalMin.x, triMin.x);
        globalMin.y = Math.min(globalMin.y, triMin.y);
        globalMin.z = Math.min(globalMin.z, triMin.z);
        globalMax.x = Math.max(globalMax.x, triMax.x);
        globalMax.y = Math.max(globalMax.y, triMax.y);
        globalMax.z = Math.max(globalMax.z, triMax.z);
        tris.push({
          a,
          b,
          c,
          normal,
          bounds: new AABB(triMin, triMax),
        });
      }
    }

    this.triangles = tris;
    this.bounds = new AABB(globalMin, globalMax);
  }

  traceBox(req: TraceBoxRequest): TraceResult {
    const start = req.start;
    const end = req.end;
    const mins = req.mins;
    const maxs = req.maxs;

    const startBox = new AABB().setFromCenterExtents(start, mins, maxs);
    const endBox = new AABB().setFromCenterExtents(end, mins, maxs);

    const sweepMin = new Vec3(
      Math.min(startBox.mins.x, endBox.mins.x),
      Math.min(startBox.mins.y, endBox.mins.y),
      Math.min(startBox.mins.z, endBox.mins.z)
    );
    const sweepMax = new Vec3(
      Math.max(startBox.maxs.x, endBox.maxs.x),
      Math.max(startBox.maxs.y, endBox.maxs.y),
      Math.max(startBox.maxs.z, endBox.maxs.z)
    );
    const sweepBox = new AABB(sweepMin, sweepMax);

    if (!this.bounds.intersects(sweepBox)) {
      return {
        fraction: 1,
        endPos: end.clone(),
        planeNormal: new Vec3(0, 0, 1),
        startSolid: false,
        allSolid: false,
        contents: Contents.EMPTY,
      };
    }

    const startHit = this.boxIntersectsTriangles(startBox, sweepBox);
    const startSolid = startHit !== null;

    let hitNormal = new Vec3(0, 0, 1);
    let hitFraction = 1;

    if (!startSolid) {
      const tmpPos = new Vec3();
      for (let i = 1; i <= this.steps; i += 1) {
        const t = i / this.steps;
        Vec3.lerp(tmpPos, start, end, t);
        const box = new AABB().setFromCenterExtents(tmpPos, mins, maxs);
        const hit = this.boxIntersectsTriangles(box, sweepBox);
        if (hit) {
          hitFraction = (i - 1) / this.steps;
          hitNormal = hit;
          break;
        }
      }
    } else {
      hitFraction = 0;
      if (startHit) {
        hitNormal = startHit;
      }
    }

    const endPos = Vec3.lerp(new Vec3(), start, end, hitFraction);

    return {
      fraction: hitFraction,
      endPos,
      planeNormal: hitNormal,
      startSolid,
      allSolid: startSolid && hitFraction === 0,
      contents: startSolid ? Contents.SOLID : Contents.EMPTY,
    };
  }

  private boxIntersectsTriangles(box: AABB, sweepBox: AABB): Vec3 | null {
    for (const tri of this.triangles) {
      if (!tri.bounds.intersects(sweepBox)) {
        continue;
      }
      if (triangleIntersectsAABB(tri, box)) {
        return tri.normal;
      }
    }
    return null;
  }
}

function triangleIntersectsAABB(tri: Triangle, box: AABB): boolean {
  const center = new Vec3(
    (box.mins.x + box.maxs.x) * 0.5,
    (box.mins.y + box.maxs.y) * 0.5,
    (box.mins.z + box.maxs.z) * 0.5
  );
  const extents = new Vec3(
    (box.maxs.x - box.mins.x) * 0.5,
    (box.maxs.y - box.mins.y) * 0.5,
    (box.maxs.z - box.mins.z) * 0.5
  );

  const v0 = Vec3.sub(new Vec3(), tri.a, center);
  const v1 = Vec3.sub(new Vec3(), tri.b, center);
  const v2 = Vec3.sub(new Vec3(), tri.c, center);

  const e0 = Vec3.sub(new Vec3(), v1, v0);
  const e1 = Vec3.sub(new Vec3(), v2, v1);
  const e2 = Vec3.sub(new Vec3(), v0, v2);

  if (!axisTest(e0.z, e0.y, v0.y, v0.z, v1.y, v1.z, v2.y, v2.z, extents.y, extents.z)) return false;
  if (!axisTest(e0.z, e0.x, v0.x, v0.z, v1.x, v1.z, v2.x, v2.z, extents.x, extents.z)) return false;
  if (!axisTest(e0.y, e0.x, v0.x, v0.y, v1.x, v1.y, v2.x, v2.y, extents.x, extents.y)) return false;

  if (!axisTest(e1.z, e1.y, v0.y, v0.z, v1.y, v1.z, v2.y, v2.z, extents.y, extents.z)) return false;
  if (!axisTest(e1.z, e1.x, v0.x, v0.z, v1.x, v1.z, v2.x, v2.z, extents.x, extents.z)) return false;
  if (!axisTest(e1.y, e1.x, v0.x, v0.y, v1.x, v1.y, v2.x, v2.y, extents.x, extents.y)) return false;

  if (!axisTest(e2.z, e2.y, v0.y, v0.z, v1.y, v1.z, v2.y, v2.z, extents.y, extents.z)) return false;
  if (!axisTest(e2.z, e2.x, v0.x, v0.z, v1.x, v1.z, v2.x, v2.z, extents.x, extents.z)) return false;
  if (!axisTest(e2.y, e2.x, v0.x, v0.y, v1.x, v1.y, v2.x, v2.y, extents.x, extents.y)) return false;

  const minX = Math.min(v0.x, v1.x, v2.x);
  const maxX = Math.max(v0.x, v1.x, v2.x);
  if (minX > extents.x || maxX < -extents.x) return false;

  const minY = Math.min(v0.y, v1.y, v2.y);
  const maxY = Math.max(v0.y, v1.y, v2.y);
  if (minY > extents.y || maxY < -extents.y) return false;

  const minZ = Math.min(v0.z, v1.z, v2.z);
  const maxZ = Math.max(v0.z, v1.z, v2.z);
  if (minZ > extents.z || maxZ < -extents.z) return false;

  const normal = e0.cross(e1);
  if (!planeBoxOverlap(normal, v0, extents)) return false;

  return true;
}

function axisTest(
  a: number,
  b: number,
  v0a: number,
  v0b: number,
  v1a: number,
  v1b: number,
  v2a: number,
  v2b: number,
  fa: number,
  fb: number
): boolean {
  const p0 = a * v0a - b * v0b;
  const p1 = a * v1a - b * v1b;
  const p2 = a * v2a - b * v2b;
  const min = Math.min(p0, p1, p2);
  const max = Math.max(p0, p1, p2);
  const rad = Math.abs(a) * fa + Math.abs(b) * fb;
  return !(min > rad || max < -rad);
}

function planeBoxOverlap(normal: Vec3, vert: Vec3, maxBox: Vec3): boolean {
  const vmin = new Vec3();
  const vmax = new Vec3();

  if (normal.x > 0) {
    vmin.x = -maxBox.x - vert.x;
    vmax.x = maxBox.x - vert.x;
  } else {
    vmin.x = maxBox.x - vert.x;
    vmax.x = -maxBox.x - vert.x;
  }

  if (normal.y > 0) {
    vmin.y = -maxBox.y - vert.y;
    vmax.y = maxBox.y - vert.y;
  } else {
    vmin.y = maxBox.y - vert.y;
    vmax.y = -maxBox.y - vert.y;
  }

  if (normal.z > 0) {
    vmin.z = -maxBox.z - vert.z;
    vmax.z = maxBox.z - vert.z;
  } else {
    vmin.z = maxBox.z - vert.z;
    vmax.z = -maxBox.z - vert.z;
  }

  if (normal.dot(vmin) > 0) return false;
  return normal.dot(vmax) >= 0;
}
