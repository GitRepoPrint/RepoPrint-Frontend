import { Icon } from "@/components/ui/icon";
import type { Repository } from "@/lib/api/types";

export const HEALTHY_SCORE = 80;

const pad = (n: number) => String(n).padStart(2, "0");

// Geometria do radar (viewBox 200x200). Score 100 fica no centro, 50 ou menos na borda;
// o anel tracejado é o limiar de "healthy" (HEALTHY_SCORE).
const CENTER = 100;
const RADIUS = 92;
const MIN_SCORE = 50;
const ringRadius = (score: number) => (RADIUS * (100 - Math.max(score, MIN_SCORE))) / (100 - MIN_SCORE);
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function Blip({ repository, index }: { repository: Repository; index: number }) {
  const score = repository.score as number;
  const radius = Math.max(ringRadius(score), 8); // não deixa um 100/100 colado ao centro
  const angle = index * GOLDEN_ANGLE;
  const healthy = score >= HEALTHY_SCORE;
  return (
    <g className={`sonar-blip ${healthy ? "healthy" : "attention"}`}>
      <circle cx={CENTER + radius * Math.cos(angle)} cy={CENTER + radius * Math.sin(angle)} r={4.5}>
        <title>{`${repository.name} · ${score}/100`}</title>
      </circle>
    </g>
  );
}

type Props = { repositories: Repository[] };

// Cartão único com os projetos healthy e os que precisam de atenção, mais o radar tipo sonar.
export function RepositoryHealth({ repositories }: Props) {
  const scored = repositories.filter((r) => r.score !== null);
  const healthy = scored.filter((r) => (r.score as number) >= HEALTHY_SCORE).length;
  const attention = scored.length - healthy;
  const pending = repositories.length - scored.length;

  return (
    <section className="repository-health" aria-label="Portfolio health">
      <svg
        className="sonar"
        viewBox="0 0 200 200"
        role="img"
        aria-label={`${healthy} healthy and ${attention} needing attention, plotted by security score`}
      >
        <defs>
          <linearGradient id="sonar-sweep-fill" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="currentColor" stopOpacity="0" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0.38" />
          </linearGradient>
        </defs>
        <circle className="sonar-disc" cx={CENTER} cy={CENTER} r={RADIUS} />
        <circle className="sonar-zone" cx={CENTER} cy={CENTER} r={ringRadius(HEALTHY_SCORE)} />
        {[0.7, 1].map((fraction) => (
          <circle key={fraction} className="sonar-ring" cx={CENTER} cy={CENTER} r={RADIUS * fraction} />
        ))}
        <circle className="sonar-ring dashed" cx={CENTER} cy={CENTER} r={ringRadius(HEALTHY_SCORE)} />
        <path className="sonar-ring" d={`M${CENTER - RADIUS} ${CENTER}H${CENTER + RADIUS}M${CENTER} ${CENTER - RADIUS}V${CENTER + RADIUS}`} />
        <g className="sonar-sweep">
          <path d={`M${CENTER} ${CENTER}L${CENTER + RADIUS} ${CENTER}A${RADIUS} ${RADIUS} 0 0 0 ${CENTER + RADIUS * Math.cos(-Math.PI / 3)} ${CENTER + RADIUS * Math.sin(-Math.PI / 3)}Z`} fill="url(#sonar-sweep-fill)" />
          <line x1={CENTER} y1={CENTER} x2={CENTER + RADIUS} y2={CENTER} />
        </g>
        {scored.map((repository, index) => <Blip key={repository.name} repository={repository} index={index} />)}
        <circle className="sonar-core" cx={CENTER} cy={CENTER} r={3} />
      </svg>

      <div className="repository-health-stats">
        <div>
          <span className="stat-icon green-icon"><Icon name="shield" size={19} /></span>
          <span className="stat-label">HEALTHY PROJECTS</span>
          <strong>{pad(healthy)}</strong>
          <small>Security score of {HEALTHY_SCORE} or higher</small>
        </div>
        <div>
          <span className="stat-icon orange-icon"><Icon name="warning" size={19} /></span>
          <span className="stat-label">NEEDS ATTENTION</span>
          <strong>{pad(attention)}</strong>
          <small>Opportunity to improve</small>
        </div>
        {pending > 0 && <p className="repository-health-pending">{pad(pending)} pending analysis, not plotted</p>}
      </div>
    </section>
  );
}
