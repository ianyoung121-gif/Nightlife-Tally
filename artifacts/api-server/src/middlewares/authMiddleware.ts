import type { NextFunction, Request, Response } from "express";
import * as oidc from "openid-client";
import {
  clearSession,
  getOidcConfig,
  getSession,
  getSessionId,
  updateSession,
  type SessionData,
  type SessionUser,
} from "../lib/auth";

declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
      isAuthenticated(): this is Request & { user: SessionUser };
    }
  }
}

async function refreshIfNeeded(sid: string, session: SessionData): Promise<SessionData | null> {
  const now = Math.floor(Date.now() / 1000);
  if (!session.expiresAt || now <= session.expiresAt) return session;
  if (!session.refreshToken) return null;

  try {
    const tokens = await oidc.refreshTokenGrant(await getOidcConfig(), session.refreshToken);
    const refreshed = {
      ...session,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? session.refreshToken,
      expiresAt: tokens.expiresIn() ? now + tokens.expiresIn()! : session.expiresAt,
    };
    await updateSession(sid, refreshed);
    return refreshed;
  } catch {
    return null;
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  req.isAuthenticated = function (this: Request) {
    return this.user !== undefined;
  } as Request["isAuthenticated"];

  const sid = getSessionId(req);
  if (!sid) return next();

  const session = await getSession(sid);
  if (!session) return next();
  const refreshed = await refreshIfNeeded(sid, session);
  if (!refreshed) {
    await clearSession(res, sid);
    return next();
  }
  req.user = refreshed.user;
  next();
}