import { Vec3 } from '../../core/Math/Vec3';
import { AABB } from '../../core/Math/AABB';
import { BspData, BspModel, BspTexture } from '../../io/bsp/BspTypes';
import { BspCollisionParser } from '../../io/bsp/BspCollisionParser';
import { BspCollisionData, BspPlane } from '../../io/bsp/BspCollisionTypes';
import { ITraceWorld } from '../ITraceWorld';
import { ContentsMask, TraceBoxRequest, TraceResult, Contents } from '../TraceTypes';

const EPS = 0.03125;

export class BrushTraceWorld implements ITraceWorld {
  private collision: BspCollisionData;
  private textures: BspTexture[];
  private models: BspModel[];

  constructor(collision: BspCollisionData, textures: BspTexture[], models: BspModel[]) {
    this.collision = collision;
    this.textures = textures;
    this.models = models;
  }

  static fromBsp(bsp: BspData): BrushTraceWorld {
    const collision = BspCollisionParser.parse(bsp);
    if (collision.brushes.length === 0 || collision.planes.length === 0) {
      throw new Error('BSP collision data empty');
    }
    return new BrushTraceWorld(collision, bsp.textures, bsp.models);
  }

  traceBox(req: TraceBoxRequest): TraceResult {
    const start = req.start;
    const end = req.end;
    const mins = req.mins;
    const maxs = req.maxs;

    const sweep = new AABB().setFromCenterExtents(start, mins, maxs);
    sweep.expandByPoint(new Vec3(end.x + mins.x, end.y + mins.y, end.z + mins.z));
    sweep.expandByPoint(new Vec3(end.x + maxs.x, end.y + maxs.y, end.z + maxs.z));

    const brushIndices = this.collectBrushes(sweep);

    let fraction = 1;
    let hitNormal = new Vec3(0, 0, 1);
    let startSolid = false;
    let allSolid = false;
    let hitContents: ContentsMask | undefined;

    for (const brushIndex of brushIndices) {
      const brush = this.collision.brushes[brushIndex];
      if (!brush) {
        continue;
      }
      const contents = this.getBrushContents(brush.textureIndex);
      if ((contents & req.mask) === 0) {
        continue;
      }

      const result = this.traceBrush(brushIndex, start, end, mins, maxs);
      if (result.allSolid) {
        startSolid = true;
        allSolid = true;
        hitContents = contents;
        fraction = 0;
        break;
      }
      if (result.startSolid) {
        startSolid = true;
        hitContents = contents;
      }
      if (result.fraction < fraction) {
        fraction = result.fraction;
        hitNormal = result.planeNormal;
        hitContents = contents;
      }
    }

    const endPos = Vec3.lerp(new Vec3(), start, end, fraction);

    return {
      fraction,
      endPos,
      planeNormal: hitNormal,
      startSolid,
      allSolid,
      contents: hitContents ?? Contents.EMPTY,
    };
  }

  pointContents(p: Vec3): ContentsMask {
    const leafIndex = this.findLeafForPoint(p);
    if (leafIndex < 0) {
      return Contents.EMPTY;
    }
    const leaf = this.collision.leafs[leafIndex];
    if (!leaf) {
      return Contents.EMPTY;
    }
    let contents = Contents.EMPTY;
    const start = leaf.leafBrush;
    const end = leaf.leafBrush + leaf.numLeafBrushes;
    for (let i = start; i < end; i += 1) {
      const brushIndex = this.collision.leafBrushes[i];
      if (brushIndex === undefined || brushIndex < 0) {
        continue;
      }
      const brush = this.collision.brushes[brushIndex];
      if (!brush) {
        continue;
      }
      if (this.pointInsideBrush(p, brushIndex)) {
        contents |= this.getBrushContents(brush.textureIndex);
      }
    }
    return contents;
  }

  getModelBounds(modelIndex: number): AABB | null {
    const model = this.models[modelIndex];
    if (!model) {
      return null;
    }
    return new AABB(model.mins.clone(), model.maxs.clone());
  }

  private getBrushContents(textureIndex: number): ContentsMask {
    const tex = this.textures[textureIndex];
    return tex ? tex.contents : Contents.EMPTY;
  }

  private traceBrush(
    brushIndex: number,
    start: Vec3,
    end: Vec3,
    mins: Vec3,
    maxs: Vec3
  ): TraceResult {
    const brush = this.collision.brushes[brushIndex];
    if (!brush || brush.numSides <= 0) {
      return {
        fraction: 1,
        endPos: end.clone(),
        planeNormal: new Vec3(0, 0, 1),
        startSolid: false,
        allSolid: false,
      };
    }

    let enterFrac = -1;
    let leaveFrac = 1;
    let clipPlane: BspPlane | null = null;
    let startsOut = false;
    let getsOut = false;

    for (let i = 0; i < brush.numSides; i += 1) {
      const side = this.collision.brushSides[brush.brushSide + i];
      if (!side) {
        continue;
      }
      const plane = this.collision.planes[side.planeNum];
      if (!plane) {
        continue;
      }

      const offset =
        (plane.normal.x < 0 ? maxs.x : mins.x) * plane.normal.x +
        (plane.normal.y < 0 ? maxs.y : mins.y) * plane.normal.y +
        (plane.normal.z < 0 ? maxs.z : mins.z) * plane.normal.z;
      const dist = plane.dist - offset;
      const startDist = plane.normal.dot(start) - dist;
      const endDist = plane.normal.dot(end) - dist;

      if (startDist > 0) {
        startsOut = true;
      }
      if (endDist > 0) {
        getsOut = true;
      }

      if (startDist > 0 && endDist > 0) {
        return {
          fraction: 1,
          endPos: end.clone(),
          planeNormal: new Vec3(0, 0, 1),
          startSolid: false,
          allSolid: false,
        };
      }

      if (startDist <= 0 && endDist <= 0) {
        continue;
      }

      if (startDist > endDist) {
        const frac = (startDist - EPS) / (startDist - endDist);
        if (frac > enterFrac) {
          enterFrac = frac;
          clipPlane = plane;
        }
      } else {
        const frac = (startDist + EPS) / (startDist - endDist);
        if (frac < leaveFrac) {
          leaveFrac = frac;
        }
      }
    }

    if (!startsOut) {
      return {
        fraction: 0,
        endPos: start.clone(),
        planeNormal: new Vec3(0, 0, 1),
        startSolid: true,
        allSolid: !getsOut,
      };
    }

    if (enterFrac < leaveFrac && enterFrac > -1) {
      const clamped = Math.max(0, enterFrac);
      return {
        fraction: clamped,
        endPos: Vec3.lerp(new Vec3(), start, end, clamped),
        planeNormal: clipPlane ? clipPlane.normal.clone() : new Vec3(0, 0, 1),
        startSolid: false,
        allSolid: false,
      };
    }

    return {
      fraction: 1,
      endPos: end.clone(),
      planeNormal: new Vec3(0, 0, 1),
      startSolid: false,
      allSolid: false,
    };
  }

  private pointInsideBrush(point: Vec3, brushIndex: number): boolean {
    const brush = this.collision.brushes[brushIndex];
    if (!brush) {
      return false;
    }
    for (let i = 0; i < brush.numSides; i += 1) {
      const side = this.collision.brushSides[brush.brushSide + i];
      if (!side) {
        continue;
      }
      const plane = this.collision.planes[side.planeNum];
      if (!plane) {
        continue;
      }
      const dist = plane.normal.dot(point) - plane.dist;
      if (dist > 0) {
        return false;
      }
    }
    return true;
  }

  private collectBrushes(sweep: AABB): number[] {
    const brushes = new Set<number>();
    this.collectNodeBrushes(0, sweep, brushes);
    return Array.from(brushes.values());
  }

  private collectNodeBrushes(nodeIndex: number, sweep: AABB, out: Set<number>): void {
    if (nodeIndex < 0) {
      const leafIndex = -nodeIndex - 1;
      const leaf = this.collision.leafs[leafIndex];
      if (!leaf) {
        return;
      }
      if (!aabbIntersectsMinMax(sweep, leaf.mins, leaf.maxs)) {
        return;
      }
      const start = leaf.leafBrush;
      const end = leaf.leafBrush + leaf.numLeafBrushes;
      for (let i = start; i < end; i += 1) {
        const brushIndex = this.collision.leafBrushes[i];
        if (brushIndex === undefined || brushIndex < 0) {
          continue;
        }
        out.add(brushIndex);
      }
      return;
    }

    const node = this.collision.nodes[nodeIndex];
    if (!node) {
      return;
    }
    if (!aabbIntersectsMinMax(sweep, node.mins, node.maxs)) {
      return;
    }

    this.collectNodeBrushes(node.children[0], sweep, out);
    this.collectNodeBrushes(node.children[1], sweep, out);
  }

  private findLeafForPoint(point: Vec3): number {
    let nodeIndex = 0;
    while (nodeIndex >= 0) {
      const node = this.collision.nodes[nodeIndex];
      if (!node) {
        return -1;
      }
      const plane = this.collision.planes[node.planeIndex];
      if (!plane) {
        return -1;
      }
      const dist = plane.normal.dot(point) - plane.dist;
      nodeIndex = dist >= 0 ? node.children[0] : node.children[1];
    }
    return -nodeIndex - 1;
  }
}

function aabbIntersectsMinMax(aabb: AABB, mins: [number, number, number], maxs: [number, number, number]): boolean {
  return !(
    aabb.maxs.x < mins[0] ||
    aabb.mins.x > maxs[0] ||
    aabb.maxs.y < mins[1] ||
    aabb.mins.y > maxs[1] ||
    aabb.maxs.z < mins[2] ||
    aabb.mins.z > maxs[2]
  );
}
