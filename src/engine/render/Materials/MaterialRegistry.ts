import * as THREE from 'three';
import { MaterialFactory } from './MaterialFactory';

export class MaterialRegistry {
  private readonly materials = new Map<string, THREE.MeshStandardMaterial>();

  getOrCreate(textureName: string, wireframe: boolean): THREE.MeshStandardMaterial {
    const key = `${textureName}::${wireframe ? 'wire' : 'solid'}`;
    const existing = this.materials.get(key);
    if (existing) {
      return existing;
    }
    const material = MaterialFactory.create(textureName, wireframe);
    this.materials.set(key, material);
    return material;
  }

  getAll(): THREE.MeshStandardMaterial[] {
    return Array.from(this.materials.values());
  }
}
