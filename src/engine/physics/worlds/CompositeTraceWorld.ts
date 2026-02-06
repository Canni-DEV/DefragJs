import { ITraceWorld } from '../ITraceWorld';
import { Contents, ContentsMask, TraceBoxRequest, TraceResult } from '../TraceTypes';
import { Vec3 } from '../../core/Math/Vec3';

export class CompositeTraceWorld implements ITraceWorld {
  constructor(private readonly primary: ITraceWorld, private readonly secondary: ITraceWorld) {}

  traceBox(req: TraceBoxRequest): TraceResult {
    const a = this.primary.traceBox(req);
    const b = this.secondary.traceBox(req);

    if (a.allSolid || b.allSolid) {
      const solid = a.allSolid ? a : b;
      const mergedContents = (a.contents ?? Contents.EMPTY) | (b.contents ?? Contents.EMPTY);
      return {
        fraction: 0,
        endPos: solid.endPos.clone(),
        planeNormal: solid.planeNormal.clone(),
        startSolid: a.startSolid || b.startSolid,
        allSolid: true,
        contents: mergedContents,
        hitId: solid.hitId,
      };
    }

    const best = a.fraction <= b.fraction ? a : b;
    const startSolid = a.startSolid || b.startSolid;
    const allSolid = a.allSolid || b.allSolid;
    const contents = startSolid
      ? (a.contents ?? Contents.EMPTY) | (b.contents ?? Contents.EMPTY)
      : best.contents ?? Contents.EMPTY;

    return {
      fraction: best.fraction,
      endPos: best.endPos.clone(),
      planeNormal: best.planeNormal.clone(),
      startSolid,
      allSolid,
      contents,
      hitId: best.hitId,
    };
  }

  pointContents(p: Vec3): ContentsMask {
    let contents = Contents.EMPTY;
    if (this.primary.pointContents) {
      contents |= this.primary.pointContents(p);
    }
    if (this.secondary.pointContents) {
      contents |= this.secondary.pointContents(p);
    }
    return contents;
  }
}
