import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export const BUSINESS_SCOPE = "https://www.googleapis.com/auth/business.manage";
export const GOOGLE_FLOW_TTL = 10 * 60 * 1000;
export const GOOGLE_PROOF_TTL = 30 * 86400000;
export const hashGoogleSecret = (value: string) => createHash("sha256").update(value).digest("hex");
export const googleNonce = () => randomBytes(32).toString("base64url");

export class GoogleBusinessError extends Error {
  constructor(message: string, public status = 503) { super(message); }
}

function encryptionKey(secret: string) {
  if (secret.length < 16) throw new GoogleBusinessError("Google connection is not configured securely.");
  return createHash("sha256").update(`weekender-google-business-v1:${secret}`).digest();
}
export function sealGooglePayload(payload: unknown, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(b => b.toString("base64url")).join(".");
}
export function openGooglePayload<T>(value: string, secret: string): T {
  const pieces = value.split(".");
  if (pieces.length !== 3) throw new GoogleBusinessError("Google authorization expired. Connect again.", 401);
  const [iv, tag, encrypted] = pieces.map(v => Buffer.from(v, "base64url"));
  const cipher = createDecipheriv("aes-256-gcm", encryptionKey(secret), iv);
  cipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([cipher.update(encrypted), cipher.final()]).toString("utf8")) as T;
}
export function googleConfiguration() {
  const clientId = process.env.GOOGLE_BUSINESS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_BUSINESS_CLIENT_SECRET;
  const encryptionSecret = process.env.SESSION_SECRET;
  const redirectUri = process.env.GOOGLE_BUSINESS_REDIRECT_URI;
  if (!clientId || !clientSecret || !encryptionSecret || encryptionSecret.length < 16 || !redirectUri) return null;
  try {
    const uri = new URL(redirectUri);
    if (uri.protocol !== "https:" || uri.pathname !== "/api/google-business/callback" || uri.search || uri.hash || uri.username || uri.password) return null;
    return { clientId, clientSecret, encryptionSecret, redirectUri, origin: uri.origin };
  } catch { return null; }
}
export function googleConsentUrl(clientId: string, redirectUri: string, state: string, verifier: string) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: clientId, redirect_uri: redirectUri, response_type: "code",
    scope: BUSINESS_SCOPE, state, access_type: "online", prompt: "select_account consent",
    code_challenge_method: "S256", code_challenge: createHash("sha256").update(verifier).digest("base64url"),
  }).toString();
  return url.toString();
}
type Fetcher = typeof fetch;
async function googleJson(url: string, init: RequestInit, fetcher: Fetcher) {
  const response = await fetcher(url, { ...init, signal: AbortSignal.timeout(10000) });
  if (!response.ok) {
    if (response.status === 401) throw new GoogleBusinessError("Google authorization expired. Connect again.", 401);
    if (response.status === 403) throw new GoogleBusinessError("Google denied access. Check Business Profile API enablement, OAuth consent, and your Google account's management access.", 403);
    if (response.status === 429) throw new GoogleBusinessError("Google is temporarily rate limiting verification. Try again later.", 429);
    throw new GoogleBusinessError("Google could not complete verification. Please reconnect and try again.");
  }
  return response.json();
}
export async function exchangeGoogleCode(code: string, verifier: string, config: NonNullable<ReturnType<typeof googleConfiguration>>, fetcher: Fetcher = fetch): Promise<{ token: string; expiresIn: number }> {
  const data = await googleJson("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, code_verifier: verifier, client_id: config.clientId,
      client_secret: config.clientSecret, redirect_uri: config.redirectUri, grant_type: "authorization_code" }),
  }, fetcher) as { access_token?: string; token_type?: string; expires_in?: number; scope?: string };
  if (!data.access_token || data.token_type?.toLowerCase() !== "bearer" || !data.scope?.split(" ").includes(BUSINESS_SCOPE)) {
    throw new GoogleBusinessError("The Google Business Profile permission was not granted.", 403);
  }
  return { token: data.access_token, expiresIn: Math.min(600, typeof data.expires_in === "number" ? Math.max(0, data.expires_in) : 300) };
}
type GoogleLocation = {
  name?: string; title?: string; metadata?: { placeId?: string };
  storefrontAddress?: { regionCode?: string; addressLines?: string[]; locality?: string; administrativeArea?: string; postalCode?: string };
};
export function managedLocation(location: GoogleLocation) {
  const address = location.storefrontAddress;
  if (typeof location.name !== "string" || typeof location.metadata?.placeId !== "string" ||
    !/^locations\/[0-9]+$/.test(location.name) || !/^[A-Za-z0-9_-]{10,200}$/.test(location.metadata.placeId) || address?.regionCode !== "US") return null;
  return { name: location.name!, title: location.title || "Google business",
    address: [...(address.addressLines ?? []), address.locality, address.administrativeArea, address.postalCode].filter(Boolean).join(","),
    providerId: location.metadata!.placeId! };
}
export async function listGoogleLocations(token: string, fetcher: Fetcher = fetch) {
  const headers = { Authorization: `Bearer ${token}` };
  const locations = new Map<string, NonNullable<ReturnType<typeof managedLocation>>>();
  let accountPage = "";
  let calls = 0;
  do {
    const accountsUrl = new URL("https://mybusinessaccountmanagement.googleapis.com/v1/accounts");
    accountsUrl.search = new URLSearchParams({ pageSize: "20", ...(accountPage ? { pageToken: accountPage } : {}) }).toString();
    if (++calls > 100) throw new GoogleBusinessError("This account has too many locations to load at once. Use a Google account managing fewer venues.", 422);
    const accounts = await googleJson(accountsUrl.toString(), { headers }, fetcher) as { accounts?: Array<{ name: string }>; nextPageToken?: string };
    for (const account of accounts.accounts ?? []) {
      if (!/^accounts\/[0-9]+$/.test(account.name)) continue;
      let locationPage = "";
      do {
        if (++calls > 100) throw new GoogleBusinessError("This account has too many locations to load at once. Use a Google account managing fewer venues.", 422);
        const url = new URL(`https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations`);
        url.search = new URLSearchParams({ readMask: "name,title,storefrontAddress,metadata", pageSize: "100", ...(locationPage ? { pageToken: locationPage } : {}) }).toString();
        const page = await googleJson(url.toString(), { headers }, fetcher) as { locations?: GoogleLocation[]; nextPageToken?: string };
        for (const raw of page.locations ?? []) {
          const parsed = managedLocation(raw);
          if (parsed) locations.set(parsed.name, parsed);
        }
        locationPage = page.nextPageToken ?? "";
      } while (locationPage);
    }
    accountPage = accounts.nextPageToken ?? "";
  } while (accountPage);
  return [...locations.values()];
}
export async function verifyGoogleLocation(token: string, name: string, fetcher: Fetcher = fetch) {
  if (!/^locations\/[0-9]+$/.test(name)) throw new GoogleBusinessError("Choose a Google-managed location.", 400);
  const headers = { Authorization: `Bearer ${token}` };
  // GET is authorized by Google for this account, not by a client-supplied name or address.
  const raw = await googleJson(`https://mybusinessbusinessinformation.googleapis.com/v1/${name}?readMask=name,title,storefrontAddress,metadata`, { headers }, fetcher) as GoogleLocation;
  const location = managedLocation(raw);
  if (!location || location.name !== name) throw new GoogleBusinessError("Choose a US Google business with a Maps Place ID.", 422);
  const voice = await googleJson(`https://mybusinessverifications.googleapis.com/v1/${name}:getVoiceOfMerchantState`, { headers }, fetcher) as { hasVoiceOfMerchant?: boolean; hasBusinessAuthority?: boolean };
  if (voice.hasVoiceOfMerchant !== true || voice.hasBusinessAuthority !== true) {
    throw new GoogleBusinessError("Google has not confirmed this business's authority and good standing. Complete its Business Profile verification first.", 409);
  }
  return location;
}
