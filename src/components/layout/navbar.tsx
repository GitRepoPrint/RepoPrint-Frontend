"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DeleteAccountModal } from "@/components/layout/delete-account-modal";
import { ThemeToggle } from "@/components/theme";
import { Icon } from "@/components/ui/icon";
import { ThemedLogo } from "@/components/ui/themed-logo";
import { useToast } from "@/components/ui/toast";
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
  const { authenticated, ready, user } = useAuth();
  const { notify } = useToast();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [modalHost, setModalHost] = useState<Element | null>(null);
  const header = useRef<HTMLElement>(null);
  const closeDeleteModal = useCallback(() => setModalHost(null), []);
  const githubLogin = user?.githubLogin ?? null;

  async function disconnectGithub() {
    setProfileMenuOpen(false);
    try {
      const response = await fetch("/api/backend/github/connection", { method: "DELETE" });
      if (response.ok) { window.location.reload(); return; }
    } catch {
      /* cai na mensagem abaixo */
    }
    notify("Could not disconnect GitHub. Please try again.");
  }

  function openDeleteModal() {
    setProfileMenuOpen(false);
    setModalHost(header.current?.closest(".app-shell") ?? document.body);
  }

  return <header className="topbar app-navbar" ref={header}>
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
            {githubLogin
              ? <button type="button" role="menuitem" onClick={disconnectGithub}>Disconnect GitHub ({githubLogin})</button>
              : <button type="button" role="menuitem" onClick={() => window.location.assign("/api/github/connect")}>Connect GitHub</button>}
            {githubLogin && <button type="button" role="menuitem" onClick={() => window.location.assign("/api/github/app/install")}>Install RepoPrint app</button>}
            <button type="button" role="menuitem" onClick={() => window.location.assign("/api/backend/me/export")}>Download my data</button>
            <button type="button" role="menuitem" onClick={openDeleteModal}>Delete account</button>
            <form method="post" action="/api/auth/logout" role="none">
              <button type="submit" role="menuitem">Sign out</button>
            </form>
          </div>}
        </div> : <button className="button button-outline login-button" type="button" onClick={() => router.push("/login")}>Sign In <Icon name="arrowRight" size={15} /></button>)}
      </div>
    </div>
    {modalHost && createPortal(<DeleteAccountModal onClose={closeDeleteModal} />, modalHost)}
  </header>;
}
