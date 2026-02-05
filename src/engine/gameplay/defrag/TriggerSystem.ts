import { Vec3 } from '../../core/Math/Vec3';
import { AABB } from '../../core/Math/AABB';
import { EntityWorld } from '../entities/EntityWorld';
import { Q3Entity, TriggerType } from '../entities/EntityTypes';

export type TriggerVolume = {
  type: TriggerType;
  bounds: AABB;
  target?: string;
  entity: Q3Entity;
};

export class TriggerSystem {
  private triggers: TriggerVolume[] = [];
  private active = new Set<number>();

  static fromEntityWorld(world: EntityWorld): TriggerSystem {
    const system = new TriggerSystem();
    system.triggers = buildTriggers(world);
    return system;
  }

  update(playerBounds: AABB): TriggerVolume[] {
    const entered: TriggerVolume[] = [];
    for (let i = 0; i < this.triggers.length; i += 1) {
      const trigger = this.triggers[i];
      const isInside = trigger.bounds.intersects(playerBounds);
      const wasInside = this.active.has(i);
      if (isInside && !wasInside) {
        entered.push(trigger);
        this.active.add(i);
      } else if (!isInside && wasInside) {
        this.active.delete(i);
      }
    }
    return entered;
  }
}

function buildTriggers(world: EntityWorld): TriggerVolume[] {
  const triggers: TriggerVolume[] = [];
  for (const ent of world.getAll()) {
    const triggerType = resolveTriggerType(ent);
    if (!triggerType) {
      continue;
    }
    const bounds = resolveBounds(ent);
    if (!bounds) {
      continue;
    }
    const target = ent.properties.target ?? ent.properties.df_teleport_target;
    triggers.push({ type: triggerType, bounds, target, entity: ent });
  }
  return triggers;
}

function resolveTriggerType(ent: Q3Entity): TriggerType | null {
  const marker = ent.properties.df_trigger ?? ent.properties.defrag_trigger ?? ent.properties.trigger;
  if (marker === 'start' || marker === 'stop' || marker === 'checkpoint' || marker === 'teleport') {
    return marker;
  }

  if (ent.classname === 'target_position') {
    return 'checkpoint';
  }

  if (ent.classname === 'trigger_teleport') {
    return 'teleport';
  }

  if (ent.classname === 'trigger_multiple') {
    const kind = ent.properties.df_kind;
    if (kind === 'start' || kind === 'stop' || kind === 'checkpoint' || kind === 'teleport') {
      return kind;
    }
  }

  return null;
}

function resolveBounds(ent: Q3Entity): AABB | null {
  const origin = parseVec3(ent.properties.origin) ?? new Vec3();
  const mins = parseVec3(ent.properties.mins);
  const maxs = parseVec3(ent.properties.maxs);
  if (mins && maxs) {
    const worldMins = new Vec3(origin.x + mins.x, origin.y + mins.y, origin.z + mins.z);
    const worldMaxs = new Vec3(origin.x + maxs.x, origin.y + maxs.y, origin.z + maxs.z);
    return new AABB(worldMins, worldMaxs);
  }
  const radius = parseFloat(ent.properties.radius ?? ent.properties.df_radius ?? '48');
  const half = Math.max(8, radius);
  const worldMins = new Vec3(origin.x - half, origin.y - half, origin.z - half);
  const worldMaxs = new Vec3(origin.x + half, origin.y + half, origin.z + half);
  return new AABB(worldMins, worldMaxs);
}

function parseVec3(value: string | undefined): Vec3 | null {
  if (!value) {
    return null;
  }
  const parts = value.trim().split(/\s+/).map((v) => Number(v));
  if (parts.length < 3 || parts.some((v) => Number.isNaN(v))) {
    return null;
  }
  return new Vec3(parts[0], parts[1], parts[2]);
}
