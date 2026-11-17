import type { CSSProperties } from "react";

type SkeletonProps = {
  width?: number | string;
  height?: number | string;
  circle?: boolean;
  /** Dentro de uma linha de texto (em vez de ocupar uma linha). */
  inline?: boolean;
  className?: string;
};

/** Um bloco que cintila no lugar de algo que ainda não chegou. É só decoração: quem usa um leitor de ecrã ouve o texto da página. */
export function Skeleton({ width = "100%", height = 16, circle = false, inline = false, className = "" }: SkeletonProps) {
  const style: CSSProperties = { width, height, ...(inline ? { display: "inline-block", verticalAlign: "middle" } : {}) };
  return <span className={`skeleton${circle ? " skeleton-circle" : ""} ${className}`.trim()} style={style} aria-hidden="true" />;
}
