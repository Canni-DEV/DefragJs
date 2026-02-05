import { Q3Entity } from './EntityTypes';

export class EntityWorld {
  private readonly entities: Q3Entity[];
  private readonly byClass = new Map<string, Q3Entity[]>();

  constructor(entities: Q3Entity[]) {
    this.entities = entities;
    for (const ent of entities) {
      const list = this.byClass.get(ent.classname) ?? [];
      list.push(ent);
      this.byClass.set(ent.classname, list);
    }
  }

  getAll(): Q3Entity[] {
    return this.entities;
  }

  findByClass(classname: string): Q3Entity[] {
    return this.byClass.get(classname) ?? [];
  }

  findFirstByClass(classname: string): Q3Entity | null {
    const list = this.byClass.get(classname);
    if (!list || list.length === 0) {
      return null;
    }
    return list[0] ?? null;
  }
}
