"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ThemeToggle } from "@/components/theme";
import { Icon } from "@/components/ui/icon";
import { ThemedLogo } from "@/components/ui/themed-logo";
import { useAuth } from "@/lib/auth/auth-provider";

function Logo({ href }: { href: string }) {
  // priority: o logo está sempre visível no topo, por isso é carregado logo (não "lazy").
  return (
    <Link className="brand" href={href} aria-label="RepoPrint home">
      <ThemedLogo priority />
    </Link>
  );
}

export default function Navbar() {
  const router = useRouter();
  const { authenticated, ready } = useAuth();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  return <header className="topbar app-navbar">
    <div className="nav-inner">
      <div className="nav-left"><Logo href={authenticated ? "/repositories" : "/"} /></div>
      <div className="nav-actions">
        <ThemeToggle />
        {ready && (authenticated ? <div className="profile-menu-wrap" onBlur={event => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setProfileMenuOpen(false);
        }} onKeyDown={event => {
          if (event.key === "Escape") setProfileMenuOpen(false);
        }}>
          <button className="profile-trigger" type="button" aria-label="User options" title="User options" aria-haspopup="menu" aria-expanded={profileMenuOpen} onClick={() => setProfileMenuOpen(open => !open)}>
            <svg className="profile-user-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21a8 8 0 0 1 16 0" />
            </svg>
          </button>
          {profileMenuOpen && <div className="profile-menu" role="menu">
            <form method="post" action="/api/auth/logout" role="none">
              <button type="submit" role="menuitem">Sign out</button>
            </form>
          </div>}
        </div> : <button className="button button-outline login-button" type="button" onClick={() => router.push("/login")}>Sign In <Icon name="arrowRight" size={15} /></button>)}
      </div>
    </div>
  </header>;
}
