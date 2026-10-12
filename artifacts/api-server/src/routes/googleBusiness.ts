import { Router, type Request, type Response } from "express";
import { and, eq, gt, lt } from "drizzle-orm";
import { db, barsTable, googleBusinessSessionsTable as flows, googleVenueLinksTable as links } from "@workspace/db";
import { LinkVenueGoogleLocationBody, GetVenueGoogleConnectionResponse, ListManagedGoogleLocationsResponse } from "@workspace/api-zod";
import { requireBarOwner } from "../lib/authorization";
import { GoogleBusinessError, googleConfiguration, googleNonce, hashGoogleSecret, sealGooglePayload, openGooglePayload, googleConsentUrl, exchangeGoogleCode, listGoogleLocations, verifyGoogleLocation, GOOGLE_FLOW_TTL, GOOGLE_PROOF_TTL } from "../lib/googleBusinessClient";

const router = Router();
const BROWSER_COOKIE = "weekender_google_browser";
const GRANT_COOKIE = "weekender_google_grant";
const opaque = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
const cookieOptions = (req: Request) => ({ httpOnly: true, sameSite: "lax" as const, secure: req.secure || process.env.NODE_ENV === "production", path: "/api", maxAge: GOOGLE_FLOW_TTL });
const clearCookies = (res: Response) => {
  res.clearCookie(BROWSER_COOKIE, { path: "/api" });
  res.clearCookie(GRANT_COOKIE, { path: "/api" });
};
const cleanup = () => db.delete(flows).where(lt(flows.expiresAt, new Date()));
function fail(res: Response, error: unknown) {
  res.status(error instanceof GoogleBusinessError ? error.status : 503).json({
    error: error instanceof GoogleBusinessError ? error.message : "Google verification could not be completed. Reconnect and try again.",
  });
}
async function authorizedBar(req: Request, res: Response) {
  const id = Number(req.params.barId);
  if (!Number.isSafeInteger(id) || id < 1) { res.status(400).json({ error: "Invalid venue." }); return null; }
  return await requireBarOwner(req, res, id) ? id : null;
}
async function pendingGrant(req: Request, barId: number) {
  if (!req.user) return null;
  const cookie = req.cookies?.[GRANT_COOKIE];
  const browser = req.cookies?.[BROWSER_COOKIE];
  if (!opaque(cookie) || !opaque(browser)) return null;
  const [grant] = await db.select().from(flows).where(and(
    eq(flows.hash, hashGoogleSecret(cookie)), eq(flows.browserHash, hashGoogleSecret(browser)),
    eq(flows.userId, req.user.id), eq(flows.barId, barId), eq(flows.phase, "grant"), gt(flows.expiresAt, new Date()),
  ));
  return grant ?? null;
}
async function connectionStatus(req: Request, barId: number) {
  const [link] = await db.select().from(links).where(eq(links.barId, barId));
  return GetVenueGoogleConnectionResponse.parse({
    configured: Boolean(googleConfiguration()), pending: Boolean(await pendingGrant(req, barId)),
    providerId: link?.providerId ?? null, verifiedAt: link?.verifiedAt.toISOString() ?? null,
    expiresAt: link?.expiresAt.toISOString() ?? null,
    needsReverification: Boolean(link && (link.ownerId !== req.user!.id || link.expiresAt.getTime() <= Date.now())),
  });
}
router.use(["/google-business", "/bars/:barId/google-business"], (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});
router.get("/bars/:barId/google-business", async (req, res): Promise<void> => {
  const barId = await authorizedBar(req, res); if (barId === null) return;
  await cleanup();
  res.json(await connectionStatus(req, barId));
});
router.post("/bars/:barId/google-business/connect", async (req, res): Promise<void> => {
  const barId = await authorizedBar(req, res); if (barId === null) return;
  const config = googleConfiguration();
  if (!config) { res.status(503).json({ error: "Google owner connection is available on the published website after this update is published." }); return; }
  if (req.headers.origin && req.headers.origin !== config.origin) {
    res.status(503).json({ error: `Open ${config.origin} to connect Google. Preview and production must not share OAuth callbacks.` }); return;
  }
  await cleanup();
  await db.delete(flows).where(and(eq(flows.userId, req.user!.id), eq(flows.barId, barId)));
  const state = googleNonce(), browser = googleNonce(), verifier = googleNonce();
  await db.insert(flows).values({ hash: hashGoogleSecret(state), browserHash: hashGoogleSecret(browser),
    userId: req.user!.id, barId, phase: "state", expiresAt: new Date(Date.now() + GOOGLE_FLOW_TTL),
    encryptedPayload: sealGooglePayload({ verifier }, config.encryptionSecret) });
  res.clearCookie(GRANT_COOKIE, { path: "/api" });
  res.cookie(BROWSER_COOKIE, browser, cookieOptions(req));
  res.json({ url: googleConsentUrl(config.clientId, config.redirectUri, state, verifier) });
});
router.get("/google-business/callback", async (req, res): Promise<void> => {
  const config = googleConfiguration();
  if (!config) { res.status(503).json({ error: "Google connection is not configured." }); return; }
  const state = req.query.state, browser = req.cookies?.[BROWSER_COOKIE];
  if (!opaque(state) || !opaque(browser)) { res.status(400).json({ error: "Invalid Google callback. Start again from your dashboard." }); return; }
  // Consume once, and only from the browser that began the authenticated flow.
  const [flow] = await db.delete(flows).where(and(eq(flows.hash, hashGoogleSecret(state)),
    eq(flows.browserHash, hashGoogleSecret(browser)), eq(flows.phase, "state"), gt(flows.expiresAt, new Date()))).returning();
  if (!flow) { res.status(400).json({ error: "Google callback expired or already used. Start again." }); return; }
  const [bar] = await db.select().from(barsTable).where(eq(barsTable.id, flow.barId));
  if (!bar || bar.ownerId !== flow.userId || (req.isAuthenticated() && req.user.id !== flow.userId)) {
    clearCookies(res); res.status(403).json({ error: "The account or venue changed. Sign in and start again." }); return;
  }
  const back = (outcome: string) => res.redirect(`${config.origin}/dashboard?googleBusiness=${outcome}`);
  if (req.query.error) { clearCookies(res); back("denied"); return; }
  if (typeof req.query.code !== "string" || !req.query.code || req.query.code.length > 4096) {
    clearCookies(res); res.status(400).json({ error: "Google did not return an authorization code." }); return;
  }
  try {
    const { verifier } = openGooglePayload<{ verifier: string }>(flow.encryptedPayload, config.encryptionSecret);
    const authorization = await exchangeGoogleCode(req.query.code, verifier, config);
    const grant = googleNonce();
    await db.insert(flows).values({ hash: hashGoogleSecret(grant), browserHash: hashGoogleSecret(browser),
      userId: flow.userId, barId: flow.barId, phase: "grant",
      encryptedPayload: sealGooglePayload({ token: authorization.token }, config.encryptionSecret),
      expiresAt: new Date(Date.now() + authorization.expiresIn * 1000) });
    res.cookie(BROWSER_COOKIE, browser, cookieOptions(req));
    res.cookie(GRANT_COOKIE, grant, cookieOptions(req));
    back("choose");
  } catch {
    clearCookies(res); back("error");
  }
});
router.get("/bars/:barId/google-business/locations", async (req, res): Promise<void> => {
  const barId = await authorizedBar(req, res); if (barId === null) return;
  const grant = await pendingGrant(req, barId), config = googleConfiguration();
  if (!grant || !config) { res.status(401).json({ error: "Google authorization expired. Connect again." }); return; }
  try {
    const { token } = openGooglePayload<{ token: string }>(grant.encryptedPayload, config.encryptionSecret);
    res.json(ListManagedGoogleLocationsResponse.parse(await listGoogleLocations(token)));
  } catch (error) { fail(res, error); }
});
router.post("/bars/:barId/google-business/locations", async (req, res): Promise<void> => {
  const barId = await authorizedBar(req, res); if (barId === null) return;
  const body = LinkVenueGoogleLocationBody.safeParse(req.body);
  if (!body.success || body.data.confirmedSameVenue !== true) {
    res.status(400).json({ error: "Confirm that the selected Google location is this venue." }); return;
  }
  const grant = await pendingGrant(req, barId), config = googleConfiguration();
  if (!grant || !config) { res.status(401).json({ error: "Google authorization expired. Connect again." }); return; }
  try {
    const { token } = openGooglePayload<{ token: string }>(grant.encryptedPayload, config.encryptionSecret);
    const location = await verifyGoogleLocation(token, body.data.locationName);
    await db.transaction(async tx => {
      const [bar] = await tx.select().from(barsTable).where(eq(barsTable.id, barId)).for("update");
      if (bar?.ownerId !== req.user!.id) throw new GoogleBusinessError("Venue ownership changed. Start again.", 403);
      const [oldLink] = await tx.select().from(links).where(eq(links.barId, barId));
      if (oldLink && oldLink.providerId !== location.providerId) throw new GoogleBusinessError("Disconnect the current Google venue before selecting a different one.", 409);
      const [existing] = await tx.select().from(links).where(eq(links.providerId, location.providerId)).for("update");
      if (existing && existing.barId !== barId) {
        if (existing.expiresAt.getTime() > Date.now()) throw new GoogleBusinessError("This Google venue is already connected to another Weekender profile.", 409);
        await tx.delete(links).where(eq(links.barId, existing.barId));
      }
      const consumed = await tx.delete(flows).where(and(eq(flows.hash, grant.hash), gt(flows.expiresAt, new Date()))).returning({ hash: flows.hash });
      if (!consumed.length) throw new GoogleBusinessError("Google authorization expired or was already used. Connect again.", 409);
      const verifiedAt = new Date(), expiresAt = new Date(Date.now() + GOOGLE_PROOF_TTL);
      await tx.insert(links).values({ barId, ownerId: req.user!.id, providerId: location.providerId, verifiedAt, expiresAt })
        .onConflictDoUpdate({ target: links.barId, set: { ownerId: req.user!.id, providerId: location.providerId, verifiedAt, expiresAt } });
    });
    clearCookies(res);
    res.json(await connectionStatus(req, barId));
  } catch (error) {
    if ((error as { code?: string })?.code === "23505" || (error as { cause?: { code?: string } })?.cause?.code === "23505") {
      res.status(409).json({ error: "This Google venue was connected by another owner. Refresh and try again." }); return;
    }
    fail(res, error);
  }
});
router.delete("/bars/:barId/google-business", async (req, res): Promise<void> => {
  const barId = await authorizedBar(req, res); if (barId === null) return;
  try {
    await db.transaction(async tx => {
      const [bar] = await tx.select().from(barsTable).where(eq(barsTable.id, barId)).for("update");
      if (bar?.ownerId !== req.user!.id) throw new GoogleBusinessError("Venue ownership changed.", 403);
      await tx.delete(links).where(eq(links.barId, barId));
      await tx.delete(flows).where(eq(flows.barId, barId));
    });
    clearCookies(res); res.status(204).end();
  } catch (error) { fail(res, error); }
});
export default router;
