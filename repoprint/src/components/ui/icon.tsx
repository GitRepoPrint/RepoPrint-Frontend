import type { ReactNode } from "react";

export type IconName = "arrow" | "arrowRight" | "branch" | "check" | "chevron" | "clock" | "close" | "code" | "database" | "download" | "external" | "file" | "flow" | "github" | "grid" | "info" | "layers" | "lock" | "message" | "minus" | "moon" | "more" | "plus" | "save" | "search" | "send" | "shield" | "spark" | "sun" | "trend" | "warning";

export function Icon({ name, size = 18, className = "" }: { name: IconName; size?: number; className?: string }) {
  const paths: Record<IconName, ReactNode> = {
    arrow: <path d="m12 19-7-7 7-7M5 12h14" />,
    arrowRight: <path d="M5 12h14m-7-7 7 7-7 7" />,
    branch: <><circle cx="6" cy="3" r="2" /><circle cx="6" cy="21" r="2" /><circle cx="18" cy="6" r="2" /><path d="M6 5v14m12-11a6 6 0 0 1-6 6H6" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m6 9 6 6 6-6" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    close: <path d="M18 6 6 18M6 6l12 12" />,
    code: <><path d="m8 8-4 4 4 4m8-8 4 4-4 4m-3-13-2 18" /></>,
    database: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></>,
    download: <><path d="M12 3v12m-4-4 4 4 4-4M4 17v3h16v-3" /></>,
    external: <><path d="M13 5h6v6m0-6-9 9" /><path d="M19 14v5H5V5h5" /></>,
    file: <><path d="M6 2h8l4 4v16H6zM14 2v5h4M9 12h6m-6 4h6" /></>,
    flow: <><rect x="2" y="8" width="6" height="8" rx="1" /><rect x="16" y="2" width="6" height="8" rx="1" /><rect x="16" y="14" width="6" height="8" rx="1" /><path d="M8 12h4a4 4 0 0 0 4-4m-4 4a4 4 0 0 1 4 4" /></>,
    github: <path d="M9 19c-4.4 1.4-4.4-2.5-6-3m12 6v-3.9a3.4 3.4 0 0 0-.9-2.7c3-.3 6.1-1.4 6.1-6.7a5.2 5.2 0 0 0-1.4-3.6 4.8 4.8 0 0 0-.1-3.6S17.5 1.2 15 3a12.6 12.6 0 0 0-6 0C6.5 1.2 5.3 1.5 5.3 1.5a4.8 4.8 0 0 0-.1 3.6 5.2 5.2 0 0 0-1.4 3.6c0 5.3 3.1 6.4 6.1 6.7A3.4 3.4 0 0 0 9 18.1V22" />,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-8h.01" /></>,
    layers: <><path d="m12 2 9 5-9 5-9-5 9-5Zm-9 10 9 5 9-5m-18 5 9 5 9-5" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" /></>,
    message: <path d="M20 11.5a8 8 0 0 1-8 8 8.8 8.8 0 0 1-3.5-.7L4 20l1.2-4.5A8 8 0 1 1 20 11.5Z" />,
    minus: <path d="M5 12h14" />,
    moon: <path d="M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z" />,
    more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    save: <><path d="M4 3h14l3 3v15H3V3h1Zm3 0v6h10V3M7 21v-8h10v8" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m16 16 5 5" /></>,
    send: <><path d="m22 2-7 20-4-9-9-4 20-7Zm0 0L11 13" /></>,
    shield: <><path d="m12 2 9 4v6c0 5.5-3.5 8.5-9 10-5.5-1.5-9-4.5-9-10V6l9-4Z" /><path d="m9 12 2 2 4-4" /></>,
    spark: <path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Zm7 14 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" />,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
    trend: <><path d="m3 17 6-6 4 4 8-8m-6 0h6v6" /></>,
    warning: <><path d="M10.3 3.6 2.4 18a2 2 0 0 0 1.8 3h15.6a2 2 0 0 0 1.8-3L13.7 3.6a2 2 0 0 0-3.4 0Z" /><path d="M12 9v5m0 3h.01" /></>,
  };
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
