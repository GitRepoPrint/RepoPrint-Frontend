// Dockerfile -> imagem de base (do último estágio) e portas expostas.
export interface DockerfileInfo {
  /** Imagem de base do último estágio; null se vier de uma variável que não se resolve. */
  base: string | null;
  baseLine: number | null;
  expose: number[];
}

/** Junta as linhas continuadas com "\" e guarda a linha onde cada instrução começa. */
function instructions(text: string): { line: number; text: string }[] {
  const out: { line: number; text: string }[] = [];
  let current: { line: number; text: string } | null = null;
  text.split(/\r?\n/).forEach((raw, index) => {
    const trimmed = raw.trim();
    if (!current && (trimmed === "" || trimmed.startsWith("#"))) return;
    if (current && trimmed.startsWith("#")) return; // comentário no meio de uma instrução continuada
    const continued = trimmed.endsWith("\\");
    const piece = continued ? trimmed.slice(0, -1).trim() : trimmed;
    if (!current) current = { line: index + 1, text: piece };
    else current.text += ` ${piece}`;
    if (!continued) {
      out.push(current);
      current = null;
    }
  });
  if (current) out.push(current);
  return out;
}

export function parseDockerfile(text: string): DockerfileInfo {
  const args = new Map<string, string>();
  const stages = new Map<string, string>();
  const expose: number[] = [];
  let base: string | null = null;
  let baseLine: number | null = null;

  const substitute = (value: string) =>
    value.replace(/\$\{(\w+)(?::?-([^}]*))?\}|\$(\w+)/g, (_, braced, fallback, bare) => args.get(braced ?? bare) ?? fallback ?? `$${braced ?? bare}`);

  for (const { line, text: instruction } of instructions(text)) {
    const [keyword, ...rest] = instruction.split(/\s+/);
    switch (keyword.toUpperCase()) {
      case "ARG": {
        const [name, ...value] = rest.join(" ").split("=");
        if (name && value.length) args.set(name.trim(), value.join("=").trim().replace(/^["']|["']$/g, ""));
        break;
      }
      case "FROM": {
        const words = rest.filter((w) => !w.startsWith("--"));
        const image = substitute(words[0] ?? "");
        const alias = words[1]?.toUpperCase() === "AS" ? words[2]?.toLowerCase() : undefined;
        const resolved = stages.get(image.toLowerCase()) ?? image;
        if (alias) stages.set(alias, resolved);
        base = resolved.includes("$") ? null : resolved;
        baseLine = line;
        break;
      }
      case "EXPOSE":
        for (const token of rest) {
          const port = token.match(/^(\d+)(\/(tcp|udp))?$/i);
          if (port) expose.push(Number(port[1]));
        }
        break;
    }
  }
  return { base, baseLine, expose: [...new Set(expose)] };
}
