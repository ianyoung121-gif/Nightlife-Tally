import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { db, sessionsTable, usersTable, type User } from "@workspace/db";
import * as oidc from "openid-client";

export const ISSUER_URL = process.env.ISSUER_URL ?? "https://replit.com/oidc";

export async function deleteSession(sid: string): Promise<void> {
  await db.delete(sessionsTable).where(eq(sessionsTable.sid, sid));
}

export async function clearSession(res: Response, sid?: string): Promise<void> {
  if (sid) await deleteSession(sid);
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

export async function updateSession(sid: string, data: SessionData): Promise<void> {
  await db.update(sessionsTable).set({
    sess: data as unknown as Record<string, unknown>,
    expire: new Date(Date.now() + SESSION_TTL),
  }).where(eq(sessionsTable.sid, sid));
}

export const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;

export async function upsertOidcUser(claims: Record<string, unknown>): Promise<User> {
  const subject = typeof claims.sub === "string" ? claims.sub : "";
  if (!subject) throw new Error("OIDC response did not include a subject");

  const email = typeof claims.email === "string" && claims.email
    ? claims.email.toLowerCase()
    : `member-${subject}@accounts.invalid`;
  const avatarUrl = typeof claims.profile_image_url === "string"
    ? claims.profile_image_url
    : typeof claims.picture === "string" ? claims.picture : null;
  const username = usernameFromClaims(claims, subject);

  const [user] = await db
    .insert(usersTable)
    .values({ oidcSubject: subject, email, username, avatarUrl })
    .onConflictDoUpdate({
      target: usersTable.oidcSubject,
      set: { email, avatarUrl, updatedAt: new Date() },
    })
    .returning();
  return user;
}

function usernameFromClaims(claims: Record<string, unknown>, subject: string): string {
  const preferred = claims.preferred_username ?? claims.name;
  const base = typeof preferred === "string" && preferred.trim()
    ? preferred.trim().replace(/\s+/g, "-").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40)
    : "member";
  return `${base || "member"}-${subject.replace(/[^a-zA-Z0-9]/g, "").slice(-10)}`;
}

export function getSessionId(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  return authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : req.cookies?.[SESSION_COOKIE];
}

export interface SessionUser {
  id: number;
  username: string;
  email: string;
  avatarUrl: string | null;
  createdAt: string;
}

export function toSessionUser(user: User): SessionUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
  };
}

let oidcConfig: oidc.Configuration | null = null;

export interface SessionData {
  user: SessionUser;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

export async function getOidcConfig(): Promise<oidc.Configuration> {
  if (!oidcConfig) {
    if (!process.env.REPL_ID) {
      throw new Error("REPL_ID is required to configure authentication");
    }
    oidcConfig = await oidc.discovery(new URL(ISSUER_URL), process.env.REPL_ID);
  }
  return oidcConfig;
}

export async function createSession(data: SessionData): Promise<string> {
  const sid = crypto.randomBytes(32).toString("hex");
  await db.insert(sessionsTable).values({
    sid,
    userId: data.user.id,
    sess: data as unknown as Record<string, unknown>,
    expire: new Date(Date.now() + SESSION_TTL),
  });
  return sid;
}

export const SESSION_COOKIE = "weekender_session";

export async function getSession(sid: string): Promise<SessionData | null> {
  const [row] = await db.select().from(sessionsTable).where(eq(sessionsTable.sid, sid));
  if (!row || row.expire < new Date()) {
    if (row) await deleteSession(sid);
    return null;
  }
  return row.sess as unknown as SessionData;
}
