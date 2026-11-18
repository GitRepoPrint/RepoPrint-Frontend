// O que o backend diz de quanto código leu (meta.stats do GET /dfd): num repositório enorme lê só uma amostra, e quem vê o
// diagrama tem de saber que não é o repositório todo.
export interface CodeStats {
  files_parsed?: number;
  files_found?: number | null;
  sampled?: boolean;
  listing_truncated?: boolean;
}

const NUMBER = new Intl.NumberFormat("en-US");
const files = (n: number) => `${NUMBER.format(n)} source file${n === 1 ? "" : "s"}`;

export function codeReadSummary(stats: CodeStats | undefined): string {
  const read = stats?.files_parsed ?? 0;
  const found = stats?.files_found;
  if (stats?.sampled && typeof found === "number" && found > read) {
    const incomplete = stats.listing_truncated ? "; some folders could not be listed" : "";
    return `a sample of ${NUMBER.format(read)} of ${files(found)}, because the repository is very large${incomplete}`;
  }
  return `${files(read)} read`;
}
