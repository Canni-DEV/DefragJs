import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

const BSP_LUMPS = {
  ENTITIES: 0,
  TEXTURES: 1,
  PLANES: 2,
  NODES: 3,
  LEAFS: 4,
  LEAFFACES: 5,
  LEAFBRUSHES: 6,
  MODELS: 7,
  BRUSHES: 8,
  BRUSHSIDES: 9,
  VERTICES: 10,
  MESHVERTS: 11,
  EFFECTS: 12,
  FACES: 13,
  LIGHTMAPS: 14,
  LIGHTVOLS: 15,
  VISDATA: 16,
};

function readString(view, offset, length) {
  const bytes = new Uint8Array(view.buffer, offset, length);
  return new TextDecoder('ascii').decode(bytes).replace(/\0+$/, '');
}

function parseEntities(text) {
  const entities = [];
  let i = 0;
  const len = text.length;
  const skipWhitespace = () => {
    while (i < len && /\s/.test(text.charAt(i))) i += 1;
  };
  const readQuoted = () => {
    skipWhitespace();
    if (text.charAt(i) !== '"') return '';
    i += 1;
    let out = '';
    while (i < len && text.charAt(i) !== '"') {
      out += text.charAt(i);
      i += 1;
    }
    i += 1;
    return out;
  };
  while (i < len) {
    skipWhitespace();
    if (i >= len) break;
    if (text.charAt(i) !== '{') {
      i += 1;
      continue;
    }
    i += 1;
    const props = {};
    while (i < len) {
      skipWhitespace();
      if (text.charAt(i) === '}') {
        i += 1;
        break;
      }
      const key = readQuoted();
      const value = readQuoted();
      if (key) props[key] = value;
    }
    const classname = props.classname ?? 'unknown';
    entities.push({ classname, properties: props });
  }
  return entities;
}

function parseBsp(buffer) {
  const view = new DataView(buffer);
  const magic = readString(view, 0, 4);
  const version = view.getInt32(4, true);
  const lumps = [];
  let offset = 8;
  for (let i = 0; i < 17; i += 1) {
    const lumpOffset = view.getInt32(offset, true);
    const lumpLength = view.getInt32(offset + 4, true);
    lumps.push({ offset: lumpOffset, length: lumpLength });
    offset += 8;
  }
  return { magic, version, lumps };
}

function main() {
  const path = process.argv[2];
  const outputJson = process.argv.includes('--json');
  if (!path) {
    console.log('Usage: node tools/map_inspector/index.js <map.bsp> [--json]');
    process.exit(1);
  }
  const buffer = readFileSync(path).buffer;
  const bsp = parseBsp(buffer);
  if (bsp.magic !== 'IBSP') {
    console.error('Invalid BSP magic:', bsp.magic);
    process.exit(1);
  }

  const view = new DataView(buffer);
  const facesLump = bsp.lumps[BSP_LUMPS.FACES];
  const facesStride = 104;
  const faceCount = Math.floor(facesLump.length / facesStride);
  const faceTypes = {};
  const patchSizes = [];
  for (let i = 0; i < faceCount; i += 1) {
    const base = facesLump.offset + i * facesStride;
    const type = view.getInt32(base + 8, true);
    faceTypes[type] = (faceTypes[type] ?? 0) + 1;
    if (type === 2) {
      const sizeX = view.getInt32(base + 96, true);
      const sizeY = view.getInt32(base + 100, true);
      patchSizes.push([sizeX, sizeY]);
    }
  }

  const entitiesLump = bsp.lumps[BSP_LUMPS.ENTITIES];
  const entBytes = new Uint8Array(buffer, entitiesLump.offset, entitiesLump.length);
  const entitiesText = new TextDecoder('utf-8').decode(entBytes).replace(/\0+$/, '');
  const entities = parseEntities(entitiesText);
  const brushEntities = entities.filter((e) => typeof e.properties.model === 'string' && e.properties.model.startsWith('*'));

  const brushesLump = bsp.lumps[BSP_LUMPS.BRUSHES];
  const brushCount = Math.floor(brushesLump.length / 12);

  const report = {
    map: basename(path),
    version: bsp.version,
    faces: faceCount,
    faceTypes,
    patches: patchSizes.length,
    brushes: brushCount,
    entities: entities.length,
    brushEntities: brushEntities.map((e) => ({
      classname: e.classname,
      model: e.properties.model,
      target: e.properties.target ?? '',
    })),
  };

  if (outputJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log('Map:', report.map);
  console.log('Version:', report.version);
  console.log('Faces:', report.faces);
  console.log('Face types:', report.faceTypes);
  console.log('Patches:', report.patches);
  console.log('Brushes:', report.brushes);
  console.log('Entities:', report.entities);
  console.log('Entities with model *n:', report.brushEntities.length);
  report.brushEntities.slice(0, 20).forEach((e) => {
    console.log(`- ${e.classname} model=${e.model} target=${e.target}`);
  });
}

main();
