import { BspData, BspFace, BspVertex } from '../../io/bsp/BspTypes';
import { PatchTessellator } from './PatchTessellator';

export type GeometryBatch = {
  textureName: string;
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
};

export type TriangulationReport = {
  totalFaces: number;
  byType: Record<number, number>;
  skippedFaces: number;
  invalidVertexFaces: number;
  invalidMeshVertFaces: number;
  meshVertOutOfRange: number;
  fanFaces: number;
  meshFaces: number;
  invalidFaceSamples: number[];
};

export class FaceTriangulator {
  static buildBatches(
    bsp: BspData,
    patchSubdiv = 5,
    onDebugReport?: (report: TriangulationReport) => void
  ): GeometryBatch[] {
    const batches = new Map<string, GeometryBatch>();
    const report: TriangulationReport | null = onDebugReport
      ? {
          totalFaces: 0,
          byType: {},
          skippedFaces: 0,
          invalidVertexFaces: 0,
          invalidMeshVertFaces: 0,
          meshVertOutOfRange: 0,
          fanFaces: 0,
          meshFaces: 0,
          invalidFaceSamples: [],
        }
      : null;

    const getBatch = (textureName: string): GeometryBatch => {
      const key = textureName.length > 0 ? textureName : 'default';
      const existing = batches.get(key);
      if (existing) {
        return existing;
      }
      const batch: GeometryBatch = {
        textureName: key,
        positions: [],
        normals: [],
        uvs: [],
        indices: [],
      };
      batches.set(key, batch);
      return batch;
    };

    for (let faceIndex = 0; faceIndex < bsp.faces.length; faceIndex += 1) {
      const face = bsp.faces[faceIndex];
      if (!face) {
        continue;
      }
      if (report) {
        report.totalFaces += 1;
        report.byType[face.type] = (report.byType[face.type] ?? 0) + 1;
      }
      const textureName = bsp.textures[face.textureIndex]?.name ?? 'default';
      const batch = getBatch(textureName);

      switch (face.type) {
        case 1:
          FaceTriangulator.addMeshFace(batch, bsp.vertices, bsp.meshVerts, face, report, faceIndex);
          break;
        case 2:
          FaceTriangulator.addPatchFace(batch, bsp.vertices, face, patchSubdiv);
          break;
        case 3:
          FaceTriangulator.addMeshFace(batch, bsp.vertices, bsp.meshVerts, face, report, faceIndex);
          break;
        default:
          break;
      }
    }

    if (report) {
      onDebugReport?.(report);
    }
    return Array.from(batches.values());
  }

  private static addMeshFace(
    batch: GeometryBatch,
    vertices: BspVertex[],
    meshVerts: Int32Array,
    face: BspFace,
    report: TriangulationReport | null,
    faceIndex: number
  ): void {
    const base = batch.positions.length / 3;
    const vertexStart = face.vertexIndex;
    const vertexEnd = face.vertexIndex + face.numVertices;
    if (vertexStart < 0 || vertexEnd > vertices.length) {
      if (report) {
        report.invalidVertexFaces += 1;
        report.skippedFaces += 1;
        if (report.invalidFaceSamples.length < 8) {
          report.invalidFaceSamples.push(faceIndex);
        }
      }
      return;
    }

    for (let i = 0; i < face.numVertices; i += 1) {
      const v = vertices[face.vertexIndex + i];
      if (!v) {
        if (report) {
          report.invalidVertexFaces += 1;
          report.skippedFaces += 1;
          if (report.invalidFaceSamples.length < 8) {
            report.invalidFaceSamples.push(faceIndex);
          }
        }
        return;
      }
      batch.positions.push(v.position.x, v.position.y, v.position.z);
      batch.normals.push(v.normal.x, v.normal.y, v.normal.z);
      batch.uvs.push(v.texCoord.x, v.texCoord.y);
    }

    if (face.numMeshVerts > 0) {
      if (report) {
        report.meshFaces += 1;
      }
      const meshStart = face.meshVertIndex;
      const meshEnd = face.meshVertIndex + face.numMeshVerts;
      if (meshStart < 0 || meshEnd > meshVerts.length) {
        if (report) {
          report.invalidMeshVertFaces += 1;
          report.skippedFaces += 1;
          if (report.invalidFaceSamples.length < 8) {
            report.invalidFaceSamples.push(faceIndex);
          }
        }
        return;
      }

      const start = face.meshVertIndex;
      const end = face.meshVertIndex + face.numMeshVerts;
      for (let i = start; i < end; i += 3) {
        const a = meshVerts[i];
        const b = meshVerts[i + 1];
        const c = meshVerts[i + 2];
        if (a === undefined || b === undefined || c === undefined) {
          if (report) {
            report.invalidMeshVertFaces += 1;
            report.skippedFaces += 1;
            if (report.invalidFaceSamples.length < 8) {
              report.invalidFaceSamples.push(faceIndex);
            }
          }
          return;
        }
        if (a < 0 || b < 0 || c < 0 || a >= face.numVertices || b >= face.numVertices || c >= face.numVertices) {
          if (report) {
            report.meshVertOutOfRange += 1;
            report.skippedFaces += 1;
            if (report.invalidFaceSamples.length < 8) {
              report.invalidFaceSamples.push(faceIndex);
            }
          }
          return;
        }
        batch.indices.push(base + a, base + b, base + c);
      }
    } else {
      if (report) {
        report.fanFaces += 1;
      }
      for (let i = 1; i < face.numVertices - 1; i += 1) {
        batch.indices.push(base, base + i, base + i + 1);
      }
    }
  }

  private static addPatchFace(
    batch: GeometryBatch,
    vertices: BspVertex[],
    face: BspFace,
    patchSubdiv: number
  ): void {
    const control: BspVertex[] = [];
    for (let i = 0; i < face.numVertices; i += 1) {
      const v = vertices[face.vertexIndex + i];
      if (!v) {
        continue;
      }
      control.push(v);
    }
    const expected = face.size[0] * face.size[1];
    if (control.length < 9 || control.length < expected) {
      return;
    }
    const patch = PatchTessellator.tessellate(control, face.size[0], face.size[1], patchSubdiv);
    const base = batch.positions.length / 3;
    batch.positions.push(...patch.positions);
    batch.normals.push(...patch.normals);
    batch.uvs.push(...patch.uvs);
    for (const idx of patch.indices) {
      batch.indices.push(base + idx);
    }
  }
}
