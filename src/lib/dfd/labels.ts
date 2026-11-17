// Como se parte o título de um componente em linhas para caber na forma que o desenha (um círculo de 86 de diâmetro).
const MAX_LINE = 14;
const SEPARATORS = new Set([" ", "-", "_", "/", "."]);

const fit = (line: string) => (line.length > MAX_LINE ? `${line.slice(0, MAX_LINE - 1)}…` : line);

/**
 * Até duas linhas. Os títulos curtos ficam numa; os longos partem-se no separador (espaço, "-", "_", "/", ".") mais
 * perto do meio, deixando-o no fim da primeira linha ("customers-" / "service"); sem separador, corta-se com reticências.
 */
export function titleLines(title: string): string[] {
  if (title.length < 12) return [title];
  const middle = title.length / 2;
  let best = -1;
  for (let i = 1; i < title.length - 1; i++) {
    if (SEPARATORS.has(title[i]) && (best < 0 || Math.abs(i - middle) < Math.abs(best - middle))) best = i;
  }
  if (best < 0) return [fit(title)];
  const first = title.slice(0, best + 1).trimEnd();
  return [fit(first), fit(title.slice(best + 1))];
}
