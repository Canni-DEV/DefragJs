import { Vec3 } from '../../core/Math/Vec3';
import { AABB } from '../../core/Math/AABB';
import { BspData, BspFace, BspTexture, BspVertex } from '../../io/bsp/BspTypes';
import { PatchTessellator } from '../../render/Geometry/PatchTessellator';
import { ITraceWorld } from '../ITraceWorld';
import { TraceBoxRequest, TraceResult, Contents, ContentsMask } from '../TraceTypes';

type Triangle = {
  a: Vec3;
  b: Vec3;
  c: Vec3;
  normal: Vec3;
  bounds: AABB;
  contents: ContentsMask;
};

type TriMeshBuildOptions = {
  faceFilter?: (face: BspFace, texture: BspTexture | undefined) => boolean;
  defaultContents?: ContentsMask;
};

export class TriMeshTraceWorld implements ITraceWorld {
  private triangles: Triangle[] = [];
  private bounds: AABB = new AABB(new Vec3(), new Vec3());

  static fromBsp(
    bsp: BspData,
    patchSubdiv = 4,
    options?: TriMeshBuildOptions
  ): TriMeshTraceWorld {
    const world = new TriMeshTraceWorld();
    world.buildFromBsp(bsp, patchSubdiv, options);
    return world;
  }

  private buildFromBsp(bsp: BspData, patchSubdiv: number, options?: TriMeshBuildOptions): void {
    const tris: Triangle[] = [];
    const globalMin = new Vec3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
    const globalMax = new Vec3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);
    const faceFilter = options?.faceFilter;
    const defaultContents = options?.defaultContents ?? Contents.SOLID;

    for (let faceIndex = 0; faceIndex < bsp.faces.length; faceIndex += 1) {
      const face = bsp.faces[faceIndex];
      if (!face) {
        continue;
      }
      const texture = bsp.textures[face.textureIndex];
      if (faceFilter && !faceFilter(face, texture)) {
        continue;
      }
      const contents = texture?.contents ?? Contents.SOLID;
      const finalContents = contents === Contents.EMPTY ? defaultContents : contents;

      switch (face.type) {
        case 1:
        case 3:
          this.addMeshFaceTriangles(tris, bsp.vertices, bsp.meshVerts, face, finalContents, globalMin, globalMax);
          break;
        case 2:
          this.addPatchFaceTriangles(tris, bsp.vertices, face, patchSubdiv, finalContents, globalMin, globalMax);
          break;
        default:
          break;
      }
    }

    this.triangles = tris;
    if (tris.length === 0) {
      this.bounds = new AABB(new Vec3(), new Vec3());
    } else {
      this.bounds = new AABB(globalMin, globalMax);
    }
  }

  private addMeshFaceTriangles(
    out: Triangle[],
    vertices: BspVertex[],
    meshVerts: Int32Array,
    face: BspFace,
    contents: ContentsMask,
    globalMin: Vec3,
    globalMax: Vec3
  ): void {
    const vertexStart = face.vertexIndex;
    const vertexEnd = face.vertexIndex + face.numVertices;
    if (vertexStart < 0 || vertexEnd > vertices.length || face.numVertices < 3) {
      return;
    }

    if (face.numMeshVerts > 0) {
      const meshStart = face.meshVertIndex;
      const meshEnd = face.meshVertIndex + face.numMeshVerts;
      if (meshStart < 0 || meshEnd > meshVerts.length) {
        return;
      }
      for (let i = meshStart; i < meshEnd; i += 3) {
        const aIndex = meshVerts[i];
        const bIndex = meshVerts[i + 1];
        const cIndex = meshVerts[i + 2];
        if (
          aIndex === undefined ||
          bIndex === undefined ||
          cIndex === undefined ||
          aIndex < 0 ||
          bIndex < 0 ||
          cIndex < 0 ||
          aIndex >= face.numVertices ||
          bIndex >= face.numVertices ||
          cIndex >= face.numVertices
        ) {
          continue;
        }
        const a = vertices[vertexStart + aIndex];
        const b = vertices[vertexStart + bIndex];
        const c = vertices[vertexStart + cIndex];
        if (!a || !b || !c) {
          continue;
        }
        this.pushTriangle(out, a.position, b.position, c.position, contents, globalMin, globalMax);
      }
      return;
    }

    const base = vertices[vertexStart];
    if (!base) {
      return;
    }
    for (let i = 1; i < face.numVertices - 1; i += 1) {
      const b = vertices[vertexStart + i];
      const c = vertices[vertexStart + i + 1];
      if (!b || !c) {
        continue;
      }
      this.pushTriangle(out, base.position, b.position, c.position, contents, globalMin, globalMax);
    }
  }

  private addPatchFaceTriangles(
    out: Triangle[],
    vertices: BspVertex[],
    face: BspFace,
    patchSubdiv: number,
    contents: ContentsMask,
    globalMin: Vec3,
    globalMax: Vec3
  ): void {
    const control: BspVertex[] = [];
    for (let i = 0; i < face.numVertices; i += 1) {
      const v = vertices[face.vertexIndex + i];
      if (v) {
        control.push(v);
      }
    }
    const expected = face.size[0] * face.size[1];
    if (control.length < 9 || control.length < expected) {
      return;
    }
    const patch = PatchTessellator.tessellate(control, face.size[0], face.size[1], patchSubdiv);
    const positions = patch.positions;
    const indices = patch.indices;
    for (let i = 0; i < indices.length; i += 3) {
      const iaIndex = indices[i];
      const ibIndex = indices[i + 1];
      const icIndex = indices[i + 2];
      if (iaIndex === undefined || ibIndex === undefined || icIndex === undefined) {
        continue;
      }
      const ia = iaIndex * 3;
      const ib = ibIndex * 3;
      const ic = icIndex * 3;
      const ax = positions[ia];
      const ay = positions[ia + 1];
      const az = positions[ia + 2];
      const bx = positions[ib];
      const by = positions[ib + 1];
      const bz = positions[ib + 2];
      const cx = positions[ic];
      const cy = positions[ic + 1];
      const cz = positions[ic + 2];
      if (
        ax === undefined ||
        ay === undefined ||
        az === undefined ||
        bx === undefined ||
        by === undefined ||
        bz === undefined ||
        cx === undefined ||
        cy === undefined ||
        cz === undefined
      ) {
        continue;
      }
      this.pushTriangle(out, new Vec3(ax, ay, az), new Vec3(bx, by, bz), new Vec3(cx, cy, cz), contents, globalMin, globalMax);
    }
  }

  private pushTriangle(
    out: Triangle[],
    aPos: Vec3,
    bPos: Vec3,
    cPos: Vec3,
    contents: ContentsMask,
    globalMin: Vec3,
    globalMax: Vec3
  ): void {
    const a = new Vec3(aPos.x, aPos.y, aPos.z);
    const b = new Vec3(bPos.x, bPos.y, bPos.z);
    const c = new Vec3(cPos.x, cPos.y, cPos.z);
    const ab = Vec3.sub(new Vec3(), b, a);
    const ac = Vec3.sub(new Vec3(), c, a);
    const normal = ab.cross(ac).normalize();
    if (normal.lengthSq() < 1e-10) {
      return;
    }
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
    out.push({
      a,
      b,
      c,
      normal,
      bounds: new AABB(triMin, triMax),
      contents,
    });
  }

  traceBox(req: TraceBoxRequest): TraceResult {
    if (this.triangles.length === 0) {
      return {
        fraction: 1,
        endPos: req.end.clone(),
        planeNormal: new Vec3(0, 0, 1),
        startSolid: false,
        allSolid: false,
        contents: Contents.EMPTY,
      };
    }
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

    const startHit = this.boxIntersectsTriangles(startBox, sweepBox, req.mask);
    const velocity = Vec3.sub(new Vec3(), end, start);
    const startSolid = startHit !== null;

    let hitNormal = new Vec3(0, 0, 1);
    let hitFraction = 1;
    let hitContents: ContentsMask = Contents.EMPTY;

    if (startSolid && startHit) {
      hitFraction = 0;
      hitNormal = this.orientNormal(startHit.normal, velocity);
      hitContents = startHit.contents;
    }

    if (!startSolid) {
      for (const tri of this.triangles) {
        if ((tri.contents & req.mask) === 0) {
          continue;
        }
        if (!tri.bounds.intersects(sweepBox)) {
          continue;
        }
        const hit = sweepAabbToTriangle(start, end, mins, maxs, tri);
        if (hit && hit.fraction < hitFraction) {
          hitFraction = hit.fraction;
          hitNormal = this.orientNormal(hit.normal, velocity);
          hitContents = tri.contents;
        }
      }
    }

    const endPos = Vec3.lerp(new Vec3(), start, end, hitFraction);

    return {
      fraction: hitFraction,
      endPos,
      planeNormal: hitNormal,
      startSolid,
      allSolid: startSolid && hitFraction === 0,
      contents: hitFraction < 1 ? hitContents : Contents.EMPTY,
    };
  }

  private boxIntersectsTriangles(box: AABB, sweepBox: AABB, mask: ContentsMask): Triangle | null {
    for (const tri of this.triangles) {
      if ((tri.contents & mask) === 0) {
        continue;
      }
      if (!tri.bounds.intersects(sweepBox)) {
        continue;
      }
      if (triangleIntersectsAABB(tri, box)) {
        return tri;
      }
    }
    return null;
  }

  private orientNormal(normal: Vec3, velocity: Vec3): Vec3 {
    const out = normal.clone();
    if (velocity.dot(out) > 0) {
      out.scale(-1);
    }
    return out;
  }
}

function sweepAabbToTriangle(
  start: Vec3,
  end: Vec3,
  mins: Vec3,
  maxs: Vec3,
  tri: Triangle
): { fraction: number; normal: Vec3 } | null {
  const normal = tri.normal;
  const offset =
    (normal.x < 0 ? maxs.x : mins.x) * normal.x +
    (normal.y < 0 ? maxs.y : mins.y) * normal.y +
    (normal.z < 0 ? maxs.z : mins.z) * normal.z;
  const planeDist = normal.dot(tri.a);
  const dist = planeDist - offset;
  const startDist = normal.dot(start) - dist;
  const endDist = normal.dot(end) - dist;

  if (startDist > 0 && endDist > 0) {
    return null;
  }
  if (startDist <= 0 && endDist <= 0) {
    return null;
  }

  const denom = startDist - endDist;
  if (Math.abs(denom) < 1e-6) {
    return null;
  }
  const frac = (startDist - 0.03125) / denom;
  if (frac < 0 || frac > 1) {
    return null;
  }

  const center = Vec3.lerp(new Vec3(), start, end, frac);
  const contact = new Vec3(
    center.x - normal.x * offset,
    center.y - normal.y * offset,
    center.z - normal.z * offset
  );

  if (!pointInTriangle(contact, tri.a, tri.b, tri.c)) {
    return null;
  }

  return { fraction: Math.max(0, frac), normal };
}

function pointInTriangle(p: Vec3, a: Vec3, b: Vec3, c: Vec3): boolean {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const abz = b.z - a.z;
  const acx = c.x - a.x;
  const acy = c.y - a.y;
  const acz = c.z - a.z;
  const apx = p.x - a.x;
  const apy = p.y - a.y;
  const apz = p.z - a.z;

  const d00 = abx * abx + aby * aby + abz * abz;
  const d01 = abx * acx + aby * acy + abz * acz;
  const d11 = acx * acx + acy * acy + acz * acz;
  const d20 = apx * abx + apy * aby + apz * abz;
  const d21 = apx * acx + apy * acy + apz * acz;
  const denom = d00 * d11 - d01 * d01;
  if (Math.abs(denom) < 1e-8) {
    return false;
  }
  const v = (d11 * d20 - d01 * d21) / denom;
  const w = (d00 * d21 - d01 * d20) / denom;
  const u = 1 - v - w;
  const eps = -1e-4;
  return u >= eps && v >= eps && w >= eps;
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
