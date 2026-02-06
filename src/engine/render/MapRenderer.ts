import * as THREE from 'three';
import { BspData } from '../io/bsp/BspTypes';
import { FaceTriangulator, GeometryBatch } from './Geometry/FaceTriangulator';
import { MaterialRegistry } from './Materials/MaterialRegistry';

export type MapRenderOptions = {
  wireframe?: boolean;
  patchSubdiv?: number;
  doubleSided?: boolean;
  debugMesh?: boolean;
  chunkSize?: number;
};

export class MapRenderer {
  build(bsp: BspData, options: MapRenderOptions = {}): THREE.Group {
    const wireframe = options.wireframe ?? false;
    const patchSubdiv = options.patchSubdiv ?? 5;
    const doubleSided = options.doubleSided ?? false;
    const debugMesh = options.debugMesh ?? false;
    const chunkSize = options.chunkSize ?? 0;

    const batches = FaceTriangulator.buildBatches(
      bsp,
      patchSubdiv,
      debugMesh
        ? (report) => {
            const label = '[DefragJs] Mesh report';
            console.log(label);
            console.table(report.byType);
            console.log(report);
            if (report.invalidFaceSamples.length > 0) {
              console.log('Invalid face samples:', report.invalidFaceSamples);
            }
          }
        : undefined
    );
    const registry = new MaterialRegistry();

    if (chunkSize > 0) {
      const group = new THREE.Group();
      for (const batch of batches) {
        const chunks = splitBatchIntoChunks(batch, chunkSize);
        for (const chunk of chunks) {
          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute('position', new THREE.Float32BufferAttribute(chunk.positions, 3));
          geometry.setAttribute('normal', new THREE.Float32BufferAttribute(chunk.normals, 3));
          geometry.setAttribute('uv', new THREE.Float32BufferAttribute(chunk.uvs, 2));
          geometry.setIndex(chunk.indices);
          geometry.computeBoundingBox();
          geometry.computeBoundingSphere();

          const material = registry.getOrCreate(chunk.textureName, wireframe, doubleSided);
          const mesh = new THREE.Mesh(geometry, material);
          group.add(mesh);
        }
      }
      return group;
    }

    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    const groupInfo: { start: number; count: number; material: THREE.MeshStandardMaterial }[] = [];

    for (const batch of batches) {
      const base = positions.length / 3;
      const indexStart = indices.length;

      positions.push(...batch.positions);
      normals.push(...batch.normals);
      uvs.push(...batch.uvs);
      for (const idx of batch.indices) {
        indices.push(base + idx);
      }

      const indexCount = indices.length - indexStart;
      const material = registry.getOrCreate(batch.textureName, wireframe, doubleSided);
      groupInfo.push({ start: indexStart, count: indexCount, material });
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();

    const materials = groupInfo.map((g) => g.material);
    const mesh = new THREE.Mesh(geometry, materials);
    groupInfo.forEach((g, i) => {
      geometry.addGroup(g.start, g.count, i);
    });

    const group = new THREE.Group();
    group.add(mesh);
    return group;
  }
}

function splitBatchIntoChunks(batch: GeometryBatch, chunkSize: number): GeometryBatch[] {
  const chunks = new Map<string, GeometryBatch>();
  const positions = batch.positions;
  const normals = batch.normals;
  const uvs = batch.uvs;
  const indices = batch.indices;

  const getChunk = (key: string): GeometryBatch => {
    const existing = chunks.get(key);
    if (existing) {
      return existing;
    }
    const chunk: GeometryBatch = {
      textureName: batch.textureName,
      positions: [],
      normals: [],
      uvs: [],
      indices: [],
    };
    chunks.set(key, chunk);
    return chunk;
  };

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
      ax === undefined || ay === undefined || az === undefined ||
      bx === undefined || by === undefined || bz === undefined ||
      cx === undefined || cy === undefined || cz === undefined
    ) {
      continue;
    }

    const centerX = (ax + bx + cx) / 3;
    const centerY = (ay + by + cy) / 3;
    const centerZ = (az + bz + cz) / 3;
    const key = `${Math.floor(centerX / chunkSize)}:${Math.floor(centerY / chunkSize)}:${Math.floor(centerZ / chunkSize)}`;
    const chunk = getChunk(key);

    const base = chunk.positions.length / 3;
    chunk.positions.push(ax, ay, az, bx, by, bz, cx, cy, cz);

    const na = iaIndex * 3;
    const nb = ibIndex * 3;
    const nc = icIndex * 3;
    chunk.normals.push(
      normals[na] ?? 0,
      normals[na + 1] ?? 0,
      normals[na + 2] ?? 1,
      normals[nb] ?? 0,
      normals[nb + 1] ?? 0,
      normals[nb + 2] ?? 1,
      normals[nc] ?? 0,
      normals[nc + 1] ?? 0,
      normals[nc + 2] ?? 1
    );

    const ta = iaIndex * 2;
    const tb = ibIndex * 2;
    const tc = icIndex * 2;
    chunk.uvs.push(
      uvs[ta] ?? 0,
      uvs[ta + 1] ?? 0,
      uvs[tb] ?? 0,
      uvs[tb + 1] ?? 0,
      uvs[tc] ?? 0,
      uvs[tc + 1] ?? 0
    );

    chunk.indices.push(base, base + 1, base + 2);
  }

  return Array.from(chunks.values());
}
