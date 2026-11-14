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

/** Número da linha (a contar de 1) onde `needle` aparece pela primeira vez a partir de `from`; 1 se não aparecer. */
export function lineOf(text: string, needle: string, from = 0): number {
  const index = text.indexOf(needle, from);
  if (index < 0) return 1;
  let line = 1;
  for (let i = text.indexOf("\n"); i >= 0 && i < index; i = text.indexOf("\n", i + 1)) line++;
  return line;
}
