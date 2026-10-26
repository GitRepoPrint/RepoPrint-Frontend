import { InstantAnalyzer } from "@/components/instant/instant-analyzer";

// Server Component: só fornece a parte estática do hero (título e subtítulo).
// O <main> da landing e o relatório para impressão vivem no InstantAnalyzer
// porque têm de ser irmãos diretos do .app-shell (o CSS de impressão depende disso).
export default function Landing() {
  return (
    <InstantAnalyzer>
      <h1>From Code to <span>Threats,</span><br />Instantly<span className="hero-period">.</span></h1>
      <p className="hero-subtitle">Semi-automated Data Flow Diagrams and Git profiling<br className="desktop-break" /> from any public repository URL.</p>
    </InstantAnalyzer>
  );
}
