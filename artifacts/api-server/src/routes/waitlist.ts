import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, waitlistTable } from "@workspace/db";
import { z } from "zod/v4";

const router: IRouter = Router();

const JoinWaitlistBody = z.object({
  email: z.email(),
  name: z.string().min(1).max(100).optional(),
  message: z.string().max(500).optional(),
});

router.post("/waitlist", async (req, res): Promise<void> => {
  const parsed = JoinWaitlistBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { email, name, message } = parsed.data;

  const [existing] = await db
    .select()
    .from(waitlistTable)
    .where(eq(waitlistTable.email, email));

  if (existing) {
    res.status(409).json({ error: "Email already on waitlist", status: existing.status });
    return;
  }

  const [entry] = await db
    .insert(waitlistTable)
    .values({ email, name, message })
    .returning();

  res.status(201).json({ id: entry.id, email: entry.email, status: entry.status });
});

router.get("/waitlist/check", async (req, res): Promise<void> => {
  const email = req.query.email as string;
  if (!email) {
    res.status(400).json({ error: "email query param required" });
    return;
  }

  const [entry] = await db
    .select()
    .from(waitlistTable)
    .where(eq(waitlistTable.email, email));

  if (!entry) {
    res.json({ onWaitlist: false });
    return;
  }

  res.json({ onWaitlist: true, status: entry.status });
});

export default router;
