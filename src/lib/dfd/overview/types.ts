/** Um ficheiro do repositório já descarregado. */
export interface RepoFile {
  path: string;
  text: string;
}

/** Onde, num ficheiro, se viu algo (para a proveniência). */
export interface Spot {
  file: string;
  line: number;
}

export const dirname = (path: string) => (path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : ".");
export const basename = (path: string) => path.slice(path.lastIndexOf("/") + 1);

/** Junta caminhos relativos ao estilo POSIX e resolve "." e ".."; "." é a raiz do repositório. */
export function joinPath(...parts: string[]): string {
  const out: string[] = [];
  for (const part of parts.join("/").split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  return out.length ? out.join("/") : ".";
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Procura linhas num texto sem o reler do princípio de cada vez. As procuras avançam: uma procura sem `from`
 * começa onde acabou a última (as chaves de um ficheiro aparecem pela ordem em que as lemos) e, se não achar,
 * tenta uma vez desde o princípio. Sem resultado, a linha é 1 e o índice -1.
 */
export class LineFinder {
  private readonly breaks: number[] = [];
  private cursor = 0;

  constructor(readonly text: string) {
    for (let i = text.indexOf("\n"); i >= 0; i = text.indexOf("\n", i + 1)) this.breaks.push(i);
  }

  /** Linha (a contar de 1) em que cai a posição `offset`. */
  lineAt(offset: number): number {
    let low = 0;
    let high = this.breaks.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (this.breaks[middle] < offset) low = middle + 1;
      else high = middle;
    }
    return low + 1;
  }

  /** Primeira ocorrência de `needle`. */
  find(needle: string, from?: number): { line: number; index: number } {
    let index = this.text.indexOf(needle, from ?? this.cursor);
    if (index < 0 && from === undefined) index = this.text.indexOf(needle);
    return this.found(index, needle.length);
  }

  /**
   * Primeira linha em que `key` abre a linha (depois de espaços, "-" ou aspas) e é seguida de ":", "=" ou do fim da linha.
   * Ao contrário de `find`, "PORT" não bate em "DB_PORT" nem em "PORT_FORWARD".
   */
  findKey(key: string, from?: number): { line: number; index: number } {
    const pattern = new RegExp(`^[ \\t-]*["']?${escapeRegExp(key)}["']?[ \\t]*(?:[:=]|$)`, "gm");
    pattern.lastIndex = from ?? this.cursor;
    let match = pattern.exec(this.text);
    if (!match && from === undefined) {
      pattern.lastIndex = 0;
      match = pattern.exec(this.text);
    }
    return this.found(match ? match.index + match[0].indexOf(key) : -1, key.length);
  }

  /** Como `findKey`, para JSON: `"key"` seguido de ":" em qualquer ponto da linha (os objetos podem ir numa linha só). */
  findJsonKey(key: string, from?: number): { line: number; index: number } {
    const pattern = new RegExp(`"${escapeRegExp(key)}"[ \\t\\r\\n]*:`, "g");
    pattern.lastIndex = from ?? this.cursor;
    let match = pattern.exec(this.text);
    if (!match && from === undefined) {
      pattern.lastIndex = 0;
      match = pattern.exec(this.text);
    }
    return this.found(match ? match.index + 1 : -1, key.length);
  }

  private found(index: number, length: number) {
    if (index < 0) return { line: 1, index: -1 };
    this.cursor = index + length;
    return { line: this.lineAt(index), index };
  }
}
