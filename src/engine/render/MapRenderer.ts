import * as THREE from 'three';
import { BspData } from '../io/bsp/BspTypes';
import { FaceTriangulator } from './Geometry/FaceTriangulator';
import { MaterialRegistry } from './Materials/MaterialRegistry';

export type MapRenderOptions = {
  wireframe?: boolean;
  patchSubdiv?: number;
  doubleSided?: boolean;
  debugMesh?: boolean;
};

export class MapRenderer {
  build(bsp: BspData, options: MapRenderOptions = {}): THREE.Group {
    const wireframe = options.wireframe ?? false;
    const patchSubdiv = options.patchSubdiv ?? 5;
    const doubleSided = options.doubleSided ?? false;
    const debugMesh = options.debugMesh ?? false;

    const batches = FaceTriangulator.buildBatches(
      bsp,
      patchSubdiv,
      debugMesh
        ? (report) => {
            const label = '[DefragJs] Mesh report';
            console.groupCollapsed(label);
            console.table(report.byType);
            console.log(report);
            if (report.invalidFaceSamples.length > 0) {
              console.log('Invalid face samples:', report.invalidFaceSamples);
            }
            console.groupEnd();
          }
        : undefined
    );
    const registry = new MaterialRegistry();

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
