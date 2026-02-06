import * as THREE from 'three';

export class MaterialFactory {
  static create(textureName: string, wireframe: boolean, doubleSided: boolean): THREE.MeshStandardMaterial {
    const color = MaterialFactory.colorFromName(textureName);
    return new THREE.MeshStandardMaterial({
      color,
      roughness: 0.8,
      metalness: 0.05,
      wireframe,
      side: doubleSided ? THREE.DoubleSide : THREE.FrontSide,
    });
  }

  private static colorFromName(name: string): THREE.Color {
    let hash = 0;
    for (let i = 0; i < name.length; i += 1) {
      hash = (hash * 31 + name.charCodeAt(i)) | 0;
    }
    const r = ((hash >> 16) & 0xff) / 255;
    const g = ((hash >> 8) & 0xff) / 255;
    const b = (hash & 0xff) / 255;
    return new THREE.Color(0.3 + r * 0.7, 0.3 + g * 0.7, 0.3 + b * 0.7);
  }
}
