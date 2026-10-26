"use client";

import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import type { ReactNode } from "react";
import { useMounted } from "@/hooks/use-mounted";

export type Screen = "landing" | "login" | "legal" | "repositories" | "dashboard" | "report" | "canvas";

/** Equivalente ao estado `screen` do mockup, derivado do URL. */
export function screenFromPath(path: string): Screen {
  if (path === "/") return "landing";
  if (path.startsWith("/login") || path.startsWith("/signup")) return "login";
  if (path === "/terms" || path === "/privacy") return "legal";
  if (/^\/repositories\/[^/]+\/report/.test(path)) return "report";
  if (/^\/repositories\/[^/]+\/dfd/.test(path)) return "canvas";
  if (/^\/repositories\/[^/]+/.test(path)) return "dashboard";
  return "repositories";
}

type AppShellProps = {
  navbar: ReactNode;
  footer: ReactNode;
  children: ReactNode;
};

export default function AppShell({ navbar, footer, children }: AppShellProps) {
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();
  const mounted = useMounted();

  const screen = screenFromPath(pathname);
  const theme = mounted && resolvedTheme === "light" ? "light" : "dark";

  // Como no mockup: o login não tem navbar.
  // Extra: o login, o canvas do DFD (ecrã inteiro) e o relatório (tem rodapé próprio) não mostram o footer.
  const showNavbar = screen !== "login";
  const showFooter = screen !== "login" && screen !== "canvas" && screen !== "report";

  return (
    <div className={`app-shell theme-${theme} screen-${screen}`}>
      {showNavbar && navbar}
      {children}
      {showFooter && footer}
    </div>
  );
}
