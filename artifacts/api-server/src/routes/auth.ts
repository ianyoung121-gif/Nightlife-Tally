import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import * as oidc from "openid-client";
import { barFollowsTable, db, usersTable } from "@workspace/db";
import {
  clearSession,
  createSession,
  deleteSession,
  getMobileOidcConfig,
  getOidcConfig,
  getSessionId,
  ISSUER_URL,
  SESSION_COOKIE,
  SESSION_TTL,
  toSessionUser,
  upsertOidcUser,
  type SessionData,
} from "../lib/auth";

const router = Router();
const OIDC_COOKIE_TTL = 10 * 60 * 1000;
const OIDC_COOKIE_NAMES = ["oidc_verifier", "oidc_nonce", "oidc_state", "oidc_return_to"];

function origin(req: Request): string {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
  return `${protocol}://${host}`;
}

function safeReturnTo(value: unknown): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

function oidcCookie(res: Response, name: string, value: string): void {
  res.cookie(name, value, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: OIDC_COOKIE_TTL });
}

function sessionCookie(res: Response, sid: string): void {
  res.cookie(SESSION_COOKIE, sid, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: SESSION_TTL });
}

function clearOidcCookies(res: Response): void {
  for (const cookie of OIDC_COOKIE_NAMES) {
    res.clearCookie(cookie, { path: "/" });
  }
}

async function sessionFromTokens(tokens: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers): Promise<SessionData> {
  const claims = tokens.claims();
  if (!claims) throw new Error("OIDC response did not include verified claims");
  const user = await upsertOidcUser(claims as unknown as Record<string, unknown>);
  const now = Math.floor(Date.now() / 1000);
  return {
    user: toSessionUser(user),
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: tokens.expiresIn() ? now + tokens.expiresIn()! : claims.exp,
  };
}

router.get("/auth/user", (req, res) => res.json({ user: req.isAuthenticated() ? req.user : null }));

router.get("/login", async (req, res): Promise<void> => {
  const config = await getOidcConfig();
  const callbackUrl = `${origin(req)}/api/callback`;
  const state = oidc.randomState();
  const nonce = oidc.randomNonce();
  const verifier = oidc.randomPKCECodeVerifier();
  const challenge = await oidc.calculatePKCECodeChallenge(verifier);
  const redirect = oidc.buildAuthorizationUrl(config, {
    redirect_uri: callbackUrl,
    scope: "openid email profile offline_access",
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "login consent",
    state,
    nonce,
  });
  oidcCookie(res, "oidc_verifier", verifier);
  oidcCookie(res, "oidc_nonce", nonce);
  oidcCookie(res, "oidc_state", state);
  oidcCookie(res, "oidc_return_to", safeReturnTo(req.query.returnTo));
  res.redirect(redirect.href);
});

router.get("/callback", async (req, res): Promise<void> => {
  const verifier = req.cookies?.oidc_verifier;
  const expectedState = req.cookies?.oidc_state;
  if (!verifier || !expectedState) {
    res.redirect("/api/login");
    return;
  }
  const callbackUrl = `${origin(req)}/api/callback`;
  const currentUrl = new URL(`${callbackUrl}?${new URL(req.url, `http://${req.headers.host}`).searchParams}`);
  try {
    const tokens = await oidc.authorizationCodeGrant(await getOidcConfig(), currentUrl, {
      pkceCodeVerifier: verifier,
      expectedNonce: req.cookies?.oidc_nonce,
      expectedState,
      idTokenExpected: true,
    });
    const session = await sessionFromTokens(tokens);
    sessionCookie(res, await createSession(session));
    const returnTo = safeReturnTo(req.cookies?.oidc_return_to);
    clearOidcCookies(res);
    res.redirect(returnTo);
  } catch (error) {
    req.log.warn({ err: error instanceof Error ? error.name : "unknown" }, "Browser authentication failed");
    const returnTo = safeReturnTo(req.cookies?.oidc_return_to);
    clearOidcCookies(res);
    res.redirect(returnTo);
  }
});

router.get("/logout", async (req, res): Promise<void> => {
  const returnTo = safeReturnTo(req.query.returnTo);
  await clearSession(res, getSessionId(req));
  const endSession = oidc.buildEndSessionUrl(await getOidcConfig(), {
    client_id: process.env.REPL_ID!,
    post_logout_redirect_uri: new URL(returnTo, `${origin(req)}/`).href,
  });
  res.redirect(endSession.href);
});

router.post("/mobile-auth/token-exchange", async (req, res): Promise<void> => {
  const { code, code_verifier, redirect_uri, state, nonce } = req.body ?? {};
  if (![code, code_verifier, redirect_uri, state].every((value) => typeof value === "string")) {
    res.status(400).json({ error: "Missing or invalid authorization response" });
    return;
  }
  try {
    const callbackUrl = new URL(redirect_uri);
    callbackUrl.searchParams.set("code", code);
    callbackUrl.searchParams.set("state", state);
    callbackUrl.searchParams.set("iss", ISSUER_URL);
    const tokens = await oidc.authorizationCodeGrant(await getMobileOidcConfig(), callbackUrl, {
      pkceCodeVerifier: code_verifier,
      expectedNonce: typeof nonce === "string" ? nonce : undefined,
      expectedState: state,
      idTokenExpected: true,
    });
    res.json({ token: await createSession(await sessionFromTokens(tokens)) });
  } catch (error) {
    req.log.warn({ err: error instanceof Error ? error.name : "unknown" }, "Mobile authentication failed");
    res.status(401).json({ error: "Authentication failed" });
  }
});

router.post("/mobile-auth/logout", async (req, res): Promise<void> => {
  const sid = getSessionId(req);
  if (sid) await deleteSession(sid);
  res.json({ success: true });
});

router.delete("/auth/account", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Sign in is required" });
    return;
  }

  const userId = req.user.id;
  await db.transaction(async (tx) => {
    await tx.delete(barFollowsTable).where(eq(barFollowsTable.userId, userId));
    await tx.delete(usersTable).where(eq(usersTable.id, userId));
  });

  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.json({ success: true });
});

export default router;