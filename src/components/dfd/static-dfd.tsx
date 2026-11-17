// DFD estático de exemplo (a análise instantânea mostra sempre o mesmo diagrama).
// Substitui o dfd-preview.tsx e o formal-dfd.tsx, que eram o mesmo SVG com pequenas diferenças:
//   "preview": cartão "Architecture preview" da landing
//   "formal":  secção 04 do relatório formal (impressão / PDF)

type Variant = "preview" | "formal";

const VARIANTS = {
  preview: {
    wrapClass: "report-architecture",
    svgClass: "formal-dfd preview-formal-dfd",
    arrowId: "preview-dfd-arrow",
    label: "Data flow diagram showing the customer client, API gateway, payment store and payment provider",
    // A última ligação (provider -> gateway) sai de baixo do provider.
    flows: "M145 124H270M410 124H560M700 124H760M825 156C825 225 405 225 405 170",
    flowLabels: [
      { x: 205, y: 108, text: "HTTPS / JWT" },
      { x: 485, y: 108, text: "SQL payment data" },
      { x: 590, y: 220, text: "signed webhook event" },
    ],
    provider: { x: 760, width: 130, title: "Payment Provider", subtitle: "EXTERNAL ENTITY" },
  },
  formal: {
    wrapClass: "formal-dfd-wrap",
    svgClass: "formal-dfd",
    arrowId: "formal-dfd-arrow",
    label: "DFD: customer client sends authenticated requests to API gateway, which reads and writes payment data in PostgreSQL; webhook provider sends payment events to the gateway",
    flows: "M145 124H270M410 124H560M700 124H790M790 178C790 225 405 225 405 170",
    flowLabels: [
      { x: 205, y: 108, text: "HTTPS / JWT" },
      { x: 485, y: 108, text: "SQL · payment data" },
      { x: 748, y: 108, text: "write / read" },
      { x: 590, y: 220, text: "signed webhook event" },
    ],
    provider: { x: 790, width: 100, title: "Payment", subtitle: "PROVIDER" },
  },
} as const;

function DfdLegend() {
  return (
    <div className="formal-dfd-legend"><span><i className="legend-entity" /> External entity</span><span><i className="legend-process" /> Process</span><span><i className="legend-store" /> Data store</span><span><i className="legend-flow" /> Labelled data flow</span></div>
  );
}

export function StaticDfd({ variant }: { variant: Variant }) {
  const v = VARIANTS[variant];
  const providerCenter = v.provider.x + v.provider.width / 2;

  return (
    <>
      <div className={v.wrapClass}>
        <svg className={v.svgClass} viewBox="0 0 900 270" role="img" aria-label={v.label}>
          <defs><marker id={v.arrowId} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 8 4 0 8Z" fill="#52525b" /></marker></defs>
          <path d={v.flows} fill="none" stroke="#52525b" strokeWidth="2" markerEnd={`url(#${v.arrowId})`} />
          {v.flowLabels.map((label) => <text key={label.text} x={label.x} y={label.y} textAnchor="middle">{label.text}</text>)}
          <rect x="20" y="92" width="125" height="64" rx="3" className="dfd-entity" /><text x="82" y="120" textAnchor="middle" className="dfd-label">Customer Client</text><text x="82" y="140" textAnchor="middle" className="dfd-sub-label">EXTERNAL ENTITY</text>
          <circle cx="340" cy="124" r="70" className="dfd-process" /><text x="340" y="120" textAnchor="middle" className="dfd-label">API Gateway</text><text x="340" y="140" textAnchor="middle" className="dfd-sub-label">PROCESS</text>
          <path d="M560 96h140v56H560zM572 106h118M572 142h118" className="dfd-store" /><text x="630" y="130" textAnchor="middle" className="dfd-label">Payment Store</text>
          <rect x={v.provider.x} y="92" width={v.provider.width} height="64" rx="3" className="dfd-entity" /><text x={providerCenter} y="120" textAnchor="middle" className="dfd-label">{v.provider.title}</text><text x={providerCenter} y="140" textAnchor="middle" className="dfd-sub-label">{v.provider.subtitle}</text>
        </svg>
      </div>
      <DfdLegend />
    </>
  );
}
