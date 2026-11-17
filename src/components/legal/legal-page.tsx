import type { ReactNode } from "react";

export type LegalSection = { title: string; body: ReactNode };

type LegalPageProps = {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
};

// Server Component: só texto. Cores por tema com a mesma técnica do ThemedLogo.
export function LegalPage({ title, updated, intro, sections }: LegalPageProps) {
  return (
    <main className="mx-auto w-[min(100%-40px,760px)] pb-20 pt-14 text-left">
      <p className="font-['IBM_Plex_Mono',monospace] text-[13px] tracking-wider text-[#8e8a9f] [.theme-light_&]:text-[#77718b]">
        LEGAL · LAST UPDATED {updated.toUpperCase()}
      </p>
      <h1 className="mb-3 mt-2 font-['Space_Grotesk',sans-serif] text-4xl tracking-tight text-[#f0edf8] [.theme-light_&]:text-[#26263b]">
        {title}
      </h1>
      <p className="mb-6 text-[15px] leading-relaxed text-[#999bab] [.theme-light_&]:text-[#6f7586]">{intro}</p>

      {sections.map((section, index) => (
        <section key={section.title} className="mb-8">
          <h2 className="mb-2 text-base font-semibold text-[#e9eaf1] [.theme-light_&]:text-[#26263b]">
            {index + 1}. {section.title}
          </h2>
          <div className="space-y-2 text-[15px] leading-relaxed text-[#999bab] [.theme-light_&]:text-[#6f7586]">{section.body}</div>
        </section>
      ))}
    </main>
  );
}
