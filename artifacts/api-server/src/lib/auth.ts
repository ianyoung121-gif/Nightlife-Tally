import { clerkClient, getAuth } from "@clerk/express";
import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";

type AuthenticatedUser = {
  id: number;
  clerkUserId: string;
};

function rejectUnauthenticated(res: Response): null {
  res.status(401).json({ error: "Sign in is required to manage a venue location." });
  return null;
}

export async function getAuthenticatedUser(
  req: Request,
  res: Response,
): Promise<AuthenticatedUser | null> {
  const { userId } = getAuth(req);
  if (!userId) {
    return rejectUnauthenticated(res);
  }

  const [existingUser] = await db
    .select({ id: usersTable.id, clerkUserId: usersTable.clerkUserId })
    .from(usersTable)
    .where(eq(usersTable.clerkUserId, userId));

  if (existingUser?.clerkUserId) {
    return { id: existingUser.id, clerkUserId: existingUser.clerkUserId };
  }

  const clerkUser = await clerkClient.users.getUser(userId);
  const email = clerkUser.primaryEmailAddress?.emailAddress;
  if (email) {
    const [emailMatch] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email));

    if (emailMatch) {
      await db
        .update(usersTable)
        .set({ clerkUserId: userId })
        .where(eq(usersTable.id, emailMatch.id));
      return { id: emailMatch.id, clerkUserId: userId };
    }
  }

  const [user] = await db
    .insert(usersTable)
    .values({
      clerkUserId: userId,
      username: userId,
      email: email ?? `${userId}@clerk.invalid`,
    })
    .returning({ id: usersTable.id, clerkUserId: usersTable.clerkUserId });

  return { id: user.id, clerkUserId: user.clerkUserId! };
}