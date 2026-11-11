"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

// No mockup: provider = "GitHub" | "RepoPrint" | null
export type AuthMethod = "GitHub" | "RepoPrint";

const COOKIE = "rp_session";
const METHODS: AuthMethod[] = ["GitHub", "RepoPrint"];

type AuthContextValue = {
  /** método com que o utilizador entrou, ou null */
  method: AuthMethod | null;
  authenticated: boolean;
  /** false até o cookie ser lido no cliente (evita piscar o botão "Sign In") */
  ready: boolean;
  signIn: (method: AuthMethod) => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readCookie(): AuthMethod | null {
  const raw = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${COOKIE}=`))
    ?.split("=")[1];
  return METHODS.find((m) => m === raw) ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [method, setMethod] = useState<AuthMethod | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setMethod(readCookie());
    setReady(true);
  }, []);

  const signIn = useCallback((next: AuthMethod) => {
    document.cookie = `${COOKIE}=${next}; path=/; max-age=86400; SameSite=Lax`;
    setMethod(next);
  }, []);

  const signOut = useCallback(() => {
    document.cookie = `${COOKIE}=; path=/; max-age=0; SameSite=Lax`;
    setMethod(null);
  }, []);

  const value = useMemo(
    () => ({ method, authenticated: method !== null, ready, signIn, signOut }),
    [method, ready, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
