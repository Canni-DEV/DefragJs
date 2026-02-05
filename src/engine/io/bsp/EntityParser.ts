import { Q3Entity } from '../../gameplay/entities/EntityTypes';

export class EntityParser {
  static parseEntities(text: string): Q3Entity[] {
    const entities: Q3Entity[] = [];
    let i = 0;
    const len = text.length;

    const skipWhitespace = (): void => {
      while (i < len && /\s/.test(text[i])) {
        i += 1;
      }
    };

    const readQuoted = (): string => {
      skipWhitespace();
      if (text[i] !== '"') {
        return '';
      }
      i += 1;
      let out = '';
      while (i < len && text[i] !== '"') {
        out += text[i];
        i += 1;
      }
      i += 1;
      return out;
    };

    while (i < len) {
      skipWhitespace();
      if (i >= len) {
        break;
      }
      if (text[i] !== '{') {
        i += 1;
        continue;
      }
      i += 1;
      const props: Record<string, string> = {};
      while (i < len) {
        skipWhitespace();
        if (text[i] === '}') {
          i += 1;
          break;
        }
        const key = readQuoted();
        const value = readQuoted();
        if (key.length > 0) {
          props[key] = value;
        }
      }
      const classname = props.classname ?? 'unknown';
      entities.push({ classname, properties: props });
    }

    return entities;
  }
}
