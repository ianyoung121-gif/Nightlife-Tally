import { db, barsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Request, Response } from "express";

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