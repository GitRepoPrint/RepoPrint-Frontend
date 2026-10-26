"use client";

import { ThemeProvider as NextThemes, useTheme } from "next-themes";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { useMounted } from "@/hooks/use-mounted";

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemes
      attribute="class"
      value={{ light: "theme-light", dark: "theme-dark" }}
      defaultTheme="dark"
      enableSystem={false}
      storageKey="repoprint-theme" // mesma chave do mockup
    >
      {children}
    </NextThemes>
  );
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const isDark = !mounted || resolvedTheme !== "light";

  return (
    <button
      className="theme-toggle"
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
      aria-pressed={!isDark}
    >
      <Icon name={isDark ? "sun" : "moon"} size={18} />
    </button>
  );
}
