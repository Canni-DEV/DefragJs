import { TraceBoxRequest, TraceResult, ContentsMask } from './TraceTypes';
import { Vec3 } from '../core/Math/Vec3';

export interface ITraceWorld {
  traceBox(req: TraceBoxRequest): TraceResult;
  pointContents?(p: Vec3): ContentsMask;
}
