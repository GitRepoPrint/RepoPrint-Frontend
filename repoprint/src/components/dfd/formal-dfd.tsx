import { DfdLegend } from "./dfd-legend";

// DFD estático, em estilo "documento", usado no relatório formal.
export function FormalDfd() {
  return (
    <>
      <div className="formal-dfd-wrap"><svg className="formal-dfd" viewBox="0 0 900 270" role="img" aria-label="DFD: customer client sends authenticated requests to API gateway, which reads and writes payment data in PostgreSQL; webhook provider sends payment events to the gateway">
          <defs><marker id="formal-dfd-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 8 4 0 8Z" fill="#52525b" /></marker></defs>
          <path d="M145 124H270M410 124H560M700 124H790M790 178C790 225 405 225 405 170" fill="none" stroke="#52525b" strokeWidth="2" markerEnd="url(#formal-dfd-arrow)" />
          <text x="205" y="108" textAnchor="middle">HTTPS / JWT</text><text x="485" y="108" textAnchor="middle">SQL · payment data</text><text x="748" y="108" textAnchor="middle">write / read</text><text x="590" y="220" textAnchor="middle">signed webhook event</text>
          <rect x="20" y="92" width="125" height="64" rx="3" className="dfd-entity" /><text x="82" y="120" textAnchor="middle" className="dfd-label">Customer Client</text><text x="82" y="140" textAnchor="middle" className="dfd-sub-label">EXTERNAL ENTITY</text>
          <circle cx="340" cy="124" r="70" className="dfd-process" /><text x="340" y="120" textAnchor="middle" className="dfd-label">API Gateway</text><text x="340" y="140" textAnchor="middle" className="dfd-sub-label">PROCESS</text>
          <path d="M560 96h140v56H560zM572 106h118M572 142h118" className="dfd-store" /><text x="630" y="130" textAnchor="middle" className="dfd-label">Payment Store</text>
          <rect x="790" y="92" width="100" height="64" rx="3" className="dfd-entity" /><text x="840" y="120" textAnchor="middle" className="dfd-label">Payment</text><text x="840" y="140" textAnchor="middle" className="dfd-sub-label">PROVIDER</text>
        </svg></div>
      <DfdLegend />
    </>
  );
}
