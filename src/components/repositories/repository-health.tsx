"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AnimationEvent, CSSProperties } from "react";
import { Icon } from "@/components/ui/icon";
import type { Repository } from "@/lib/api/types";

export const HEALTHY_SCORE = 80;

const ZOOM_CHANCE = 0.001;
const ZOOM_CHECK_MS = 1000;

const pad = (n: number) => String(n).padStart(2, "0");

const CENTER = 110;
const LENS_RADIUS = 82;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const HANDLE_START = LENS_RADIUS + 5;
const HANDLE_END = LENS_RADIUS + 64;
const handlePoint = (distance: number) => CENTER + distance * Math.SQRT1_2;

type Kind = "healthy" | "attention" | "pending";

const kindOf = (repository: Repository): Kind =>
  repository.score === null ? "pending" : repository.score >= HEALTHY_SCORE ? "healthy" : "attention";

function Mark({ kind }: { kind: Kind }) {
  if (kind === "healthy") return <circle className="lupa-healthy" r={8} />;
  if (kind === "pending") return <rect className="lupa-pending" x={-7.5} y={-7.5} width={15} height={15} rx={2} />;
  return (
    <>
      <circle className="lupa-orbit" r={19} />
      <path className="lupa-attention" d="M0 -10L9.5 7.5L-9.5 7.5Z" />
    </>
  );
}

const RING_BANDS = [
  { count: 18, inner: 94, outer: 101, spin: (2 * Math.PI) / 22, breath: 3.2 },
  { count: 22, inner: 102, outer: 110, spin: (-2 * Math.PI) / 32, breath: 3.8 },
  { count: 26, inner: 111, outer: 118, spin: (2 * Math.PI) / 48, breath: 4.4 },
];
const hash = (n: number) => ((n * 9301 + 49297) % 233280) / 233280;
const PARTICLES = RING_BANDS.map(({ count, inner, outer }, ring) =>
  Array.from({ length: count }, (_, i) => ({
    angle: ((i + hash(i + ring * 31) * 0.8) / count) * Math.PI * 2,
    radius: inner + hash(i * 7 + ring * 13 + 5) * (outer - inner),
    phase: hash(i * 3 + ring * 17 + 9) * Math.PI * 2,
    hertz: 1 + hash(i * 5 + ring * 11 + 2) * 0.9,
  })),
);
const PARTICLE_VIEW = 236;
const PARTICLE_RADIUS = 2.2;
const WIGGLE_PX = 2;

function LupaParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let color = "";
    let frame = 0;
    let raf = 0;
    let visible = true;

    const draw = () => {
      const size = canvas.clientWidth;
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(size * dpr)) canvas.width = canvas.height = Math.round(size * dpr);
      if (!color || frame % 30 === 0) color = getComputedStyle(canvas).getPropertyValue("--lupa-dot").trim() || "#999";
      const t = still ? 0 : performance.now() / 1000;
      const unit = size / PARTICLE_VIEW;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, size, size);
      context.fillStyle = color;
      RING_BANDS.forEach((band, ring) => {
        context.globalAlpha = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin((t * 2 * Math.PI) / band.breath + ring));
        context.beginPath();
        for (const p of PARTICLES[ring]) {
          const angle = p.angle + band.spin * t;
          const x = size / 2 + p.radius * unit * Math.cos(angle) + Math.sin(t * p.hertz * 2 * Math.PI + p.phase) * WIGGLE_PX;
          const y = size / 2 + p.radius * unit * Math.sin(angle) + Math.cos(t * p.hertz * 1.3 * Math.PI + p.phase * 1.7) * WIGGLE_PX;
          context.moveTo(x + PARTICLE_RADIUS * unit, y);
          context.arc(x, y, PARTICLE_RADIUS * unit, 0, Math.PI * 2);
        }
        context.fill();
      });
      frame += 1;
    };

    const loop = () => {
      draw();
      raf = requestAnimationFrame(loop);
    };
    const start = () => { if (!raf && !still) raf = requestAnimationFrame(loop); };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };

    draw();
    const idle = still ? window.setInterval(draw, 500) : 0;
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start(); else stop();
    });
    observer.observe(canvas);
    if (visible) start();
    return () => { stop(); observer.disconnect(); window.clearInterval(idle); };
  }, []);

  return <canvas ref={canvasRef} className="lupa-particles" aria-hidden="true" />;
}

const vars = (values: Record<string, string>) => values as CSSProperties;

const WALL_RADIUS = LENS_RADIUS - 5; 
const SHAPE_RADIUS: Record<Kind, number> = { healthy: 8, attention: 11, pending: 10 };
const SPEED_MIN = 30;
const SPEED_RANGE = 22;
const SPEED_FLOOR = 24;
const MAX_STEP_S = 0.05;
const COLLISION_LIMIT = 20;

type Body = { x: number; y: number; vx: number; vy: number; radius: number };

function createBodies(repositories: Repository[]): Body[] {
  const step = Math.min(18, 58 / Math.sqrt(Math.max(repositories.length, 1)));
  return repositories.map((repository, index) => {
    const spiralRadius = step * Math.sqrt(index + 0.6);
    const spiralAngle = index * GOLDEN_ANGLE;
    const heading = hash(index * 11 + 3) * Math.PI * 2;
    const speed = SPEED_MIN + hash(index * 17 + 7) * SPEED_RANGE;
    return {
      x: spiralRadius * Math.cos(spiralAngle),
      y: spiralRadius * Math.sin(spiralAngle),
      vx: speed * Math.cos(heading),
      vy: speed * Math.sin(heading),
      radius: SHAPE_RADIUS[kindOf(repository)],
    };
  });
}

function advance(body: Body, seconds: number) {
  body.x += body.vx * seconds;
  body.y += body.vy * seconds;
  const distance = Math.hypot(body.x, body.y);
  const limit = WALL_RADIUS - body.radius;
  if (distance <= limit) return;
  const nx = body.x / distance;
  const ny = body.y / distance;
  const outward = body.vx * nx + body.vy * ny;
  if (outward > 0) {
    body.vx -= 2 * outward * nx;
    body.vy -= 2 * outward * ny;
  }
  body.x = nx * limit;
  body.y = ny * limit;
}

function collide(a: Body, b: Body) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const distance = Math.hypot(dx, dy);
  const reach = a.radius + b.radius;
  if (distance >= reach || distance === 0) return;
  const nx = dx / distance;
  const ny = dy / distance;
  const push = (reach - distance) / 2;
  a.x -= nx * push;
  a.y -= ny * push;
  b.x += nx * push;
  b.y += ny * push;
  const approach = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
  if (approach <= 0) return;
  a.vx -= approach * nx;
  a.vy -= approach * ny;
  b.vx += approach * nx;
  b.vy += approach * ny;
}

function limitSpeed(body: Body) {
  const speed = Math.hypot(body.vx, body.vy);
  if (speed === 0) return;
  const target = Math.min(Math.max(speed, SPEED_FLOOR), SPEED_MIN + SPEED_RANGE);
  if (target === speed) return;
  body.vx *= target / speed;
  body.vy *= target / speed;
}

function useLupaZoom() {
  const [zooming, setZooming] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      if (!document.hidden && Math.random() < ZOOM_CHANCE) setZooming(true);
    }, ZOOM_CHECK_MS);
    return () => window.clearInterval(timer);
  }, []);

  const onAnimationEnd = (event: AnimationEvent) => {
    if (event.animationName === "lupa-zoom") setZooming(false);
  };

  return { zooming, onAnimationEnd };
}

function Lupa({ repositories }: { repositories: Repository[] }) {
  const { zooming, onAnimationEnd } = useLupaZoom();
  const healthy = repositories.filter((r) => kindOf(r) === "healthy").length;
  const attention = repositories.filter((r) => kindOf(r) === "attention").length;
  const pending = repositories.length - healthy - attention;
  const svgRef = useRef<SVGSVGElement>(null);
  const shapeRefs = useRef<(SVGGElement | null)[]>([]);
  const start = useMemo(() => createBodies(repositories), [repositories]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const bodies = createBodies(repositories);
    let raf = 0;
    let last = 0;
    const frame = (now: number) => {
      const seconds = last ? Math.min((now - last) / 1000, MAX_STEP_S) : 0;
      last = now;
      bodies.forEach((body) => advance(body, seconds));
      if (bodies.length <= COLLISION_LIMIT) {
        for (let i = 0; i < bodies.length; i++) {
          for (let j = i + 1; j < bodies.length; j++) collide(bodies[i], bodies[j]);
        }
        bodies.forEach((body) => {
          limitSpeed(body);
          advance(body, 0);
        });
      }
      bodies.forEach((body, i) => {
        shapeRefs.current[i]?.setAttribute("transform", `translate(${CENTER + body.x} ${CENTER + body.y})`);
      });
      raf = requestAnimationFrame(frame);
    };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; last = 0; };
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) stop();
      else if (!raf) raf = requestAnimationFrame(frame);
    });
    observer.observe(svg);
    return () => { stop(); observer.disconnect(); };
  }, [repositories]);

  return (
    <div className="lupa-wrap">
      <LupaParticles />
      <svg
        ref={svgRef}
        className="lupa"
        viewBox="12 12 232 232"
        role="img"
        aria-label={`${healthy} healthy, ${attention} needing attention${pending ? `, ${pending} pending analysis` : ""}`}
      >
        <defs>
          <clipPath id="lupa-lens"><circle cx={CENTER} cy={CENTER} r={LENS_RADIUS} /></clipPath>
        </defs>
        <g className={`lupa-body${zooming ? " is-zooming" : ""}`} onAnimationEnd={onAnimationEnd}>
          <line className="lupa-handle" x1={handlePoint(HANDLE_START)} y1={handlePoint(HANDLE_START)} x2={handlePoint(HANDLE_END)} y2={handlePoint(HANDLE_END)} />
          <line className="lupa-handle-shine" x1={handlePoint(HANDLE_START) + 8} y1={handlePoint(HANDLE_START) + 8} x2={handlePoint(HANDLE_END) - 8} y2={handlePoint(HANDLE_END) - 8} />
          <circle className="lupa-lens" cx={CENTER} cy={CENTER} r={LENS_RADIUS} />
          <g clipPath="url(#lupa-lens)">
            {repositories.map((repository, index) => {
              return (
                <g
                  key={repository.name}
                  ref={(node) => { shapeRefs.current[index] = node; }}
                  transform={`translate(${CENTER + start[index].x} ${CENTER + start[index].y})`}
                >
                  <title>{repository.score === null ? `${repository.name} · pending analysis` : `${repository.name} · ${repository.score}/100`}</title>
                  <g className="lupa-pop" style={vars({ "--in": `${index * 50}ms` })}>
                    <Mark kind={kindOf(repository)} />
                  </g>
                </g>
              );
            })}
          </g>
          <circle className="lupa-rim" cx={CENTER} cy={CENTER} r={LENS_RADIUS} />
          <path className="lupa-glint" d={`M${CENTER - 58} ${CENTER - 34}A66 66 0 0 1 ${CENTER - 22} ${CENTER - 62}`} />
        </g>
      </svg>
    </div>
  );
}

type Props = { repositories: Repository[] };

export function RepositoryHealth({ repositories }: Props) {
  const healthy = repositories.filter((r) => kindOf(r) === "healthy").length;
  const attention = repositories.filter((r) => kindOf(r) === "attention").length;
  const pending = repositories.length - healthy - attention;

  return (
    <section className="repository-health" aria-label="Portfolio health">
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
      </div>

      <Lupa repositories={repositories} />

      <ul className="lupa-legend" aria-label="Legend">
        <li><svg viewBox="0 0 16 16" aria-hidden="true"><circle className="lupa-healthy" cx="8" cy="8" r="6" /></svg>Healthy</li>
        <li><svg viewBox="0 0 16 16" aria-hidden="true"><path className="lupa-attention" d="M8 2L14 13H2Z" /></svg>Needs attention</li>
        {pending > 0 && (
          <li><svg viewBox="0 0 16 16" aria-hidden="true"><rect className="lupa-pending" x="2.5" y="2.5" width="11" height="11" rx="2" /></svg>Pending analysis</li>
        )}
      </ul>
    </section>
  );
}
