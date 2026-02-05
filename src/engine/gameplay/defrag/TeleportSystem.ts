import { Vec3 } from '../../core/Math/Vec3';
import { EntityWorld } from '../entities/EntityWorld';
import { Q3Entity } from '../entities/EntityTypes';

export class TeleportSystem {
  private readonly targets = new Map<string, Vec3>();

  static fromEntityWorld(world: EntityWorld): TeleportSystem {
    const system = new TeleportSystem();
    for (const ent of world.getAll()) {
      const targetName = ent.properties.targetname;
      if (!targetName) {
        continue;
      }
      const origin = parseVec3(ent.properties.origin);
      if (origin) {
        system.targets.set(targetName, origin);
      }
    }
    return system;
  }

  resolveTarget(target: string | undefined): Vec3 | null {
    if (!target) {
      return null;
    }
    return this.targets.get(target) ?? null;
  }
}

function parseVec3(value: string | undefined): Vec3 | null {
  if (!value) {
    return null;
  }
  const parts = value.trim().split(/\s+/).map((v) => Number(v));
  const x = parts[0];
  const y = parts[1];
  const z = parts[2];
  if (x === undefined || y === undefined || z === undefined || Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(z)) {
    return null;
  }
  return new Vec3(x, y, z);
}
