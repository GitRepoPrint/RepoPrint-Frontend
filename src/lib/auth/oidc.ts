export const SESSION_COOKIE= "rp_session";

const CLIENT_ID= "repoprint-frontend";
const ADMIN_CLIENT_ID= "repoprint-admin";

type Fetcher= typeof fetch;

function required(name: string): string {
  const value= process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export function authConfig() {
  const realmUrl= process.env.KEYCLOAK_URL ?? "http://localhost:8080/realms/repoprint";
  return {
    appUrl: process.env.APP_URL ?? "http://localhost:3000",
    realmUrl,
    adminUrl: realmUrl.replace("/realms/", "/admin/realms/"),
    clientId: CLIENT_ID,
    clientSecret: required("KEYCLOAK_CLIENT_SECRET"),
    adminClientId: ADMIN_CLIENT_ID,
    adminClientSecret: required("KEYCLOAK_ADMIN_CLIENT_SECRET"),
  };
}

export type Tokens= {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: number;
  refreshExpiresAt: number;
};

type TokenResponse= {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_expires_in: number;
};

export type GrantError= "invalid" | "unavailable";
export type GrantResult= { ok: true; tokens: Tokens } | { ok: false; error: GrantError };

async function tokenRequest(body: Record<string, string>, fetcher: Fetcher): Promise<GrantResult> {
  const { realmUrl, clientId, clientSecret }= authConfig();
  let response: Response;
  try {
    response= await fetcher(`${realmUrl}/protocol/openid-connect/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...body }),
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: "unavailable" };
  }
  if (response.ok) {
    const data= (await response.json()) as TokenResponse;
    const now= Date.now();
    return {
      ok: true,
      tokens: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        accessExpiresAt: now + data.expires_in * 1000,
        refreshExpiresAt: now + data.refresh_expires_in * 1000,
      },
    };
  }
  if (response.status >= 500) return { ok: false, error: "unavailable" };
  return { ok: false, error: "invalid" };
}

export function passwordGrant(identifier: string, password: string, fetcher: Fetcher= fetch): Promise<GrantResult> {
  return tokenRequest({ grant_type: "password", username: identifier, password, scope: "openid" }, fetcher);
}

export async function refreshTokens(refreshToken: string, fetcher: Fetcher= fetch): Promise<Tokens | null> {
  const result= await tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken }, fetcher);
  return result.ok ? result.tokens : null;
}

export async function endSession(refreshToken: string, fetcher: Fetcher= fetch): Promise<void> {
  const { realmUrl, clientId, clientSecret }= authConfig();
  await fetcher(`${realmUrl}/protocol/openid-connect/logout`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken }),
    cache: "no-store",
  }).catch(() => undefined);
}
