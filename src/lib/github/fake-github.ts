import type { Fetcher } from "./activity";

const HOUR= 60 * 60 * 1000;
const DAY= 24 * HOUR;

export interface FakeSettings {
  total: number;
  last30d: number;
  last90d: number;
  sample: object[];
  closed: object[];
  openPrs: number;
  openIssuesCount: number;
  pulls: boolean;
  empty: boolean;
  missing: boolean;
  limited: boolean;
  renamed: boolean;
}

export function commit(login: string | null, when: Date, options: { bot?: boolean; email?: string }= {}) {
  const stamp= when.toISOString();
  return {
    author: login ? { login, type: options.bot ? "Bot" : "User" } : null,
    commit: { author: { email: options.email ?? "anon@example.com" }, committer: { date: stamp } },
  };
}

export function pull(hours: number, merged= true) {
  const created= Date.UTC(2026, 9, 1);
  return {
    created_at: new Date(created).toISOString(),
    merged_at: merged ? new Date(created + hours * HOUR).toISOString() : null,
  };
}

function countResponse(count: number): Response {
  const headers: Record<string, string>= count > 1 ? { Link: `<https://api.github.com/x?per_page=1&page=${count}>; rel="last"` } : {};
  return Response.json(count ? [{}] : [], { headers });
}

function commitsResponse(url: URL, settings: FakeSettings): Response {
  if (settings.empty) return new Response(null, { status: 409 });
  const params= url.searchParams;
  if (params.get("per_page")=== "1") {
    const since= params.get("since");
    if (!since) return countResponse(settings.total);
    const recent= Date.now() - Date.parse(since) < 60 * DAY;
    return countResponse(recent ? settings.last30d : settings.last90d);
  }
  const page= Number(params.get("page") ?? 1);
  const chunk= settings.sample.slice((page - 1) * 100, page * 100);
  const headers: Record<string, string>= page * 100 < settings.sample.length
    ? { Link: `<https://api.github.com/repos/o/r/commits?per_page=100&page=${page + 1}>; rel="next"` }
    : {};
  return Response.json(chunk, { headers });
}

function pullsResponse(url: URL, settings: FakeSettings): Response {
  if (!settings.pulls) return new Response(null, { status: 404 });
  if (url.searchParams.get("state")=== "open") return countResponse(settings.openPrs);
  return Response.json(settings.closed);
}

function respond(url: URL, settings: FakeSettings): Response {
  if (settings.limited) {
    const reset= String(Math.floor(Date.now() / 1000) + 600);
    return new Response(null, { status: 403, headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": reset } });
  }
  if (settings.missing) return new Response(null, { status: 404 });
  if (url.pathname.endsWith("/commits")) return commitsResponse(url, settings);
  if (url.pathname.endsWith("/pulls")) return pullsResponse(url, settings);
  const info= Response.json({ default_branch: "main", open_issues_count: settings.openIssuesCount, stargazers_count: 7 });
  if (settings.renamed && url.pathname.startsWith("/repos/")) {
    Object.defineProperty(info, "redirected", { value: true });
    Object.defineProperty(info, "url", { value: "https://api.github.com/repositories/123" });
  }
  return info;
}

export function fakeGithub(overrides: Partial<FakeSettings>= {}) {
  const settings: FakeSettings= {
    total: 1200,
    last30d: 40,
    last90d: 300,
    sample: [],
    closed: [],
    openPrs: 3,
    openIssuesCount: 10,
    pulls: true,
    empty: false,
    missing: false,
    limited: false,
    renamed: false,
    ...overrides,
  };
  const calls: { url: URL; headers: Record<string, string> }[]= [];

  const fetcher: Fetcher= async (input, init) => {
    const url= new URL(input);
    calls.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
    return respond(url, settings);
  };

  return { fetcher, calls, settings };
}
