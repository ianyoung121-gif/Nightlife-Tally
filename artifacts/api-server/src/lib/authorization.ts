import { db, barsTable, googleVenueLinksTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Request, Response } from "express";
import { getMembership } from "./membership";

export function requireSignedIn(req: Request, res: Response): number | null {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Sign in is required" });
    return null;
  }
  return req.user.id;
}

export async function requireBarOwner(req: Request, res: Response, barId: number): Promise<boolean> {
  const userId = requireSignedIn(req, res);
  if (userId === null) return false;
  const [bar] = await db.select({ ownerId: barsTable.ownerId }).from(barsTable).where(eq(barsTable.id, barId));
  if (!bar) {
    res.status(404).json({ error: "Bar not found" });
    return false;
  }
  if (bar.ownerId !== userId) {
    res.status(403).json({ error: "You do not own this bar" });
    return false;
  }
  return true;
}

export async function requirePaidBarOwner(req: Request, res: Response, barId: number): Promise<boolean> {
  if (!await requireBarOwner(req, res, barId)) return false;
  const userId = requireSignedIn(req, res);
  if (userId === null) return false;
  try {
    const [link] = await db.select().from(googleVenueLinksTable).where(eq(googleVenueLinksTable.barId, barId));
    if (link && (link.ownerId !== userId || link.expiresAt.getTime() <= Date.now())) {
      res.status(403).json({ error: "Reconnect Google to renew your venue-management verification before publishing." });
      return false;
    }
    if (!(await getMembership(barId, userId)).active) {
      res.status(403).json({ error: "A $5/month owner membership is required for this tool." });
      return false;
    }
    return true;
  } catch {
    res.status(503).json({ error: "Membership could not be verified. Please try again." });
    return false;
  }
}