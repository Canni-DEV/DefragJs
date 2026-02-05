import { Vec3 } from '../../core/Math/Vec3';
import { BspVertex } from '../../io/bsp/BspTypes';

export type PatchMesh = {
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
};

const tmpA = new Vec3();
const tmpB = new Vec3();
const tmpC = new Vec3();

export class PatchTessellator {
  static tessellate(control: BspVertex[], width: number, height: number, steps: number): PatchMesh {
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    const patchesX = (width - 1) / 2;
    const patchesY = (height - 1) / 2;
    const vertsPerPatch = steps + 1;

    let vertexOffset = 0;

    for (let py = 0; py < patchesY; py += 1) {
      for (let px = 0; px < patchesX; px += 1) {
        const patchControl: BspVertex[] = [];
        for (let cy = 0; cy < 3; cy += 1) {
          for (let cx = 0; cx < 3; cx += 1) {
            const idx = (py * 2 + cy) * width + (px * 2 + cx);
            const v = control[idx];
            if (v) {
              patchControl.push(v);
            }
          }
        }
        if (patchControl.length < 9) {
          continue;
        }

        for (let y = 0; y <= steps; y += 1) {
          const ty = y / steps;
          const rowPos: Vec3[] = [];
          const rowNorm: Vec3[] = [];
          const rowUv: { x: number; y: number }[] = [];
          for (let x = 0; x <= steps; x += 1) {
            const tx = x / steps;
            const pos = PatchTessellator.evalPatchVec3(patchControl, tx, ty, 'position');
            const norm = PatchTessellator.evalPatchVec3(patchControl, tx, ty, 'normal');
            const uv = PatchTessellator.evalPatchVec2(patchControl, tx, ty, 'texCoord');
            rowPos.push(pos);
            rowNorm.push(norm.normalize());
            rowUv.push(uv);
          }
          for (let x = 0; x <= steps; x += 1) {
            const pos = rowPos[x]!;
            const norm = rowNorm[x]!;
            const uv = rowUv[x]!;
            positions.push(pos.x, pos.y, pos.z);
            normals.push(norm.x, norm.y, norm.z);
            uvs.push(uv.x, uv.y);
          }
        }

        for (let y = 0; y < steps; y += 1) {
          for (let x = 0; x < steps; x += 1) {
            const a = vertexOffset + y * vertsPerPatch + x;
            const b = vertexOffset + y * vertsPerPatch + x + 1;
            const c = vertexOffset + (y + 1) * vertsPerPatch + x + 1;
            const d = vertexOffset + (y + 1) * vertsPerPatch + x;
            indices.push(a, b, d, b, c, d);
          }
        }

        vertexOffset += vertsPerPatch * vertsPerPatch;
      }
    }

    return { positions, normals, uvs, indices };
  }

  private static evalPatchVec3(
    control: BspVertex[],
    tx: number,
    ty: number,
    field: 'position' | 'normal'
  ): Vec3 {
    const row0 = PatchTessellator.evalBezierVec3(control[0]![field], control[1]![field], control[2]![field], tx);
    const row1 = PatchTessellator.evalBezierVec3(control[3]![field], control[4]![field], control[5]![field], tx);
    const row2 = PatchTessellator.evalBezierVec3(control[6]![field], control[7]![field], control[8]![field], tx);
    return PatchTessellator.evalBezierVec3(row0, row1, row2, ty);
  }

  private static evalPatchVec2(
    control: BspVertex[],
    tx: number,
    ty: number,
    field: 'texCoord'
  ): { x: number; y: number } {
    const row0 = PatchTessellator.evalBezierVec2(control[0]![field], control[1]![field], control[2]![field], tx);
    const row1 = PatchTessellator.evalBezierVec2(control[3]![field], control[4]![field], control[5]![field], tx);
    const row2 = PatchTessellator.evalBezierVec2(control[6]![field], control[7]![field], control[8]![field], tx);
    return PatchTessellator.evalBezierVec2(row0, row1, row2, ty);
  }

  private static evalBezierVec3(a: Vec3, b: Vec3, c: Vec3, t: number): Vec3 {
    const inv = 1 - t;
    const inv2 = inv * inv;
    const t2 = t * t;
    tmpA.copy(a).scale(inv2);
    tmpB.copy(b).scale(2 * inv * t);
    tmpC.copy(c).scale(t2);
    return new Vec3(tmpA.x + tmpB.x + tmpC.x, tmpA.y + tmpB.y + tmpC.y, tmpA.z + tmpB.z + tmpC.z);
  }

  private static evalBezierVec2(
    a: { x: number; y: number },
    b: { x: number; y: number },
    c: { x: number; y: number },
    t: number
  ): { x: number; y: number } {
    const inv = 1 - t;
    const inv2 = inv * inv;
    const t2 = t * t;
    return {
      x: a.x * inv2 + 2 * inv * t * b.x + c.x * t2,
      y: a.y * inv2 + 2 * inv * t * b.y + c.y * t2,
    };
  }
}
