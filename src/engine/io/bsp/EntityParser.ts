import { Q3Entity } from '../../gameplay/entities/EntityTypes';

export class EntityParser {
  static parseEntities(text: string): Q3Entity[] {
    const entities: Q3Entity[] = [];
    let i = 0;
    const len = text.length;

    const skipWhitespace = (): void => {
      while (i < len) {
        const ch = text.charAt(i);
        if (!/\s/.test(ch)) {
          break;
        }
        i += 1;
      }
    };

    const readQuoted = (): string => {
      skipWhitespace();
      if (text.charAt(i) !== '"') {
        return '';
      }
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
      if (i >= len) {
        break;
      }
      if (text.charAt(i) !== '{') {
        i += 1;
        continue;
      }
      i += 1;
      const props: Record<string, string> = {};
      while (i < len) {
        skipWhitespace();
        if (text.charAt(i) === '}') {
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
