import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db, specialsTable } from "@workspace/db";

const router = Router();

router.get("/bars/:barId/specials", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.barId) ? req.params.barId[0] : req.params.barId;
  const barId = parseInt(raw, 10);
  if (isNaN(barId)) { res.status(400).json({ error: "Invalid barId" }); return; }

  const specials = await db
    .select()
    .from(specialsTable)
    .where(eq(specialsTable.barId, barId))
    .orderBy(desc(specialsTable.createdAt));

  res.json(specials.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() })));
});

router.post("/bars/:barId/specials", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.barId) ? req.params.barId[0] : req.params.barId;
  const barId = parseInt(raw, 10);
  if (isNaN(barId)) { res.status(400).json({ error: "Invalid barId" }); return; }

  const { title, description, validUntil } = req.body;
  if (!title) { res.status(400).json({ error: "title required" }); return; }

  const [special] = await db
    .insert(specialsTable)
    .values({ barId, title, description, validUntil })
    .returning();
  res.status(201).json({ ...special, createdAt: special.createdAt.toISOString() });
});

router.delete("/specials/:specialId", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.specialId) ? req.params.specialId[0] : req.params.specialId;
  const specialId = parseInt(raw, 10);
  if (isNaN(specialId)) { res.status(400).json({ error: "Invalid specialId" }); return; }

  await db.delete(specialsTable).where(eq(specialsTable.id, specialId));
  res.status(204).send();
});

export default router;
