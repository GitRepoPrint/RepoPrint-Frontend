"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ThemeToggle } from "@/components/theme";
import { useAuth } from "@/lib/auth/auth-provider";
import lightLogo from "@/assets/logos/logo_final.png";
import darkLogo from "@/assets/logos/logo_final_branco.png";

function Logo({ href }: { href: string }) {
  // Os dois logos estão no DOM; o CSS (.logo-light / .logo-dark) mostra o certo conforme o tema.
  // Assim não há JavaScript nem "piscar" no primeiro render.
  return (
    <Link className="brand" href={href} aria-label="RepoPrint home">
      <Image className="logo-dark" src={darkLogo} alt="RepoPrint" priority />
      <Image className="logo-light" src={lightLogo} alt="RepoPrint" priority />
    </Link>
  );
}

export default function Navbar() {
  const router = useRouter();
  const { authenticated, ready, signOut } = useAuth();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  function handleSignOut() {
    setProfileMenuOpen(false);
    signOut();
    router.push("/");
  }

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
            <button type="button" role="menuitem" onClick={handleSignOut}>Sign out</button>
          </div>}
        </div> : <button className="button button-outline login-button" type="button" onClick={() => router.push("/login")}>Sign In <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14m-7-7 7 7-7 7" /></svg></button>)}
      </div>
    </div>
  </header>;
}
