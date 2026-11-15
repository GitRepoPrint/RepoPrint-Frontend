"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

export type Tab= "threats" | "dfd" | "team";

const TABS: { id: Tab; label: string }[]= [
  { id: "threats", label: "Threat Modeling & Architectural Posture" },
  { id: "dfd", label: "Inferred Architecture & Data Flow Diagram" },
  { id: "team", label: "Team Dynamics & Repository Hygiene" },
];

const isTab= (value: string | null): value is Tab => TABS.some((tab) => tab.id === value);

export function useDashboardTab(fallback: Tab= "threats") {
  const router= useRouter();
  const pathname= usePathname();
  const rawTab= useSearchParams().get("tab");
  const tab: Tab= isTab(rawTab) ? rawTab : fallback;

  function selectTab(next: Tab) {
    router.replace(`${pathname}?tab=${next}`, { scroll: false });
  }

  return { tab, selectTab };
}

export function DashboardTabList({ tab, onSelect }: { tab: Tab; onSelect: (tab: Tab) => void }) {
  return (
    <nav className="dashboard-tabs" role="tablist" aria-label="Dashboard analysis sections">
      {TABS.map(({ id, label }) => (
        <button
          key={id}
          id={`${id}-tab`}
          type="button"
          className={`dashboard-tab ${tab === id ? "active" : ""}`}
          role="tab"
          aria-selected={tab === id}
          aria-controls={`${id}-panel`}
          onClick={() => onSelect(id)}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}

export function DashboardTabPanel({ tab, children }: { tab: Tab; children: ReactNode }) {
  return (
    <div className="dashboard-tab-content">
      <div id={`${tab}-panel`} className="dashboard-tab-panel" role="tabpanel" aria-labelledby={`${tab}-tab`}>
        {children}
      </div>
    </div>
  );
}
