import { authConfig } from "./oidc";

type Fetcher= typeof fetch;

export type CreateUserError= "username_taken" | "email_taken" | "password_policy" | "unavailable";
export type CreateUserResult= { ok: true } | { ok: false; error: CreateUserError };

type NewUser= { username: string; email: string; password: string };

const TOKEN_MARGIN_MS= 10_000;

let cached: { token: string; expiresAt: number } | null= null;

export function resetAdminToken() {
  cached= null;
}

async function adminToken(fetcher: Fetcher): Promise<string | null> {
  if (cached && cached.expiresAt - TOKEN_MARGIN_MS > Date.now()) return cached.token;
  const { realmUrl, adminClientId, adminClientSecret }= authConfig();
  try {
    const response= await fetcher(`${realmUrl}/protocol/openid-connect/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: adminClientId,
        client_secret: adminClientSecret,
      }),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const data= (await response.json()) as { access_token: string; expires_in: number };
    cached= { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
    return cached.token;
  } catch {
    return null;
  }
}

async function postUser(user: NewUser, token: string, fetcher: Fetcher): Promise<Response> {
  const { adminUrl }= authConfig();
  return fetcher(`${adminUrl}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      username: user.username,
      email: user.email,
      enabled: true,
      credentials: [{ type: "password", value: user.password, temporary: false }],
    }),
    cache: "no-store",
  });
}

async function mapFailure(response: Response): Promise<CreateUserError> {
  const detail= (await response.json().catch(() => ({}))) as { errorMessage?: string; error?: string };
  const message= (detail.errorMessage ?? "").toLowerCase();
  if (response.status === 409 && message.includes("username")) return "username_taken";
  if (response.status === 409 && message.includes("email")) return "email_taken";
  if (response.status === 400 && detail.error?.startsWith("invalidPassword")) return "password_policy";
  return "unavailable";
}

export async function createUser(user: NewUser, fetcher: Fetcher= fetch): Promise<CreateUserResult> {
  try {
    let token= await adminToken(fetcher);
    if (!token) return { ok: false, error: "unavailable" };
    let response= await postUser(user, token, fetcher);
    if (response.status === 401) {
      resetAdminToken();
      token= await adminToken(fetcher);
      if (!token) return { ok: false, error: "unavailable" };
      response= await postUser(user, token, fetcher);
    }
    if (response.status === 201) return { ok: true };
    return { ok: false, error: await mapFailure(response) };
  } catch {
    return { ok: false, error: "unavailable" };
  }
}
