"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

export type AuthUser= { email: string; name: string | null; role: string | null };

type AuthContextValue= {
  user: AuthUser | null;
  authenticated: boolean;
  ready: boolean;
};

type SessionResponse= { authenticated: boolean; expired: boolean; user?: AuthUser | null };

const AuthContext= createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState]= useState<{ authenticated: boolean; user: AuthUser | null; ready: boolean }>({
    authenticated: false,
    user: null,
    ready: false,
  });

  useEffect(() => {
    let active= true;
    fetch("/api/auth/session")
      .then((response) => response.json() as Promise<SessionResponse>)
      .then((data) => {
        if (!active) return;
        const { pathname }= window.location;
        if (data.expired && pathname.startsWith("/repositories")) {
          window.location.assign(`/login?error=expired&next=${encodeURIComponent(pathname)}`);
          return;
        }
        setState({ authenticated: data.authenticated, user: data.user ?? null, ready: true });
      })
      .catch(() => {
        if (active) setState((current) => ({ ...current, ready: true }));
      });
    return () => {
      active= false;
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx= useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
