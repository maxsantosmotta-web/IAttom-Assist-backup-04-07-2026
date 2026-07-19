import { Router, type IRouter } from "express";
import { clerkClient } from "@clerk/express";
import { eq } from "drizzle-orm";
import { db, users } from "@workspace/db";
import { requireAdmin } from "../middlewares/requireAdmin.js";

const router: IRouter = Router();
const PROTECTED_ADMIN_EMAIL = "maxsantosmotta@gmail.com";

router.delete("/admin/users/:id/remove-manual", requireAdmin, async (req, res): Promise<void> => {
  const id = Number.parseInt(req.params.id as string, 10);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "ID de usuário inválido" });
    return;
  }

  const [targetUser] = await db.select().from(users).where(eq(users.id, id));
  if (!targetUser) {
    res.status(404).json({ error: "Usuário não encontrado" });
    return;
  }

  if (targetUser.email.trim().toLowerCase() === PROTECTED_ADMIN_EMAIL) {
    res.status(403).json({ error: "A conta principal do administrador não pode ser excluída." });
    return;
  }

  try {
    try {
      await clerkClient.users.deleteUser(targetUser.clerkId);
    } catch (clerkError: unknown) {
      const status =
        typeof clerkError === "object" && clerkError !== null && "status" in clerkError
          ? Number((clerkError as { status?: unknown }).status)
          : undefined;

      if (status !== 404) {
        req.log.error({ err: clerkError, clerkId: targetUser.clerkId }, "Manual user deletion failed in Clerk");
        res.status(502).json({
          error: "Não foi possível excluir a conta no Clerk. Nenhuma alteração foi feita no banco.",
        });
        return;
      }
    }

    const [deleted] = await db.delete(users).where(eq(users.id, id)).returning({ id: users.id });
    if (!deleted) {
      res.status(500).json({ error: "O banco não confirmou a exclusão do usuário." });
      return;
    }

    res.json({ ok: true, deletedEmail: targetUser.email });
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : "Erro desconhecido";
    req.log.error({ err, userId: id, clerkId: targetUser.clerkId }, "Manual user deletion failed");
    res.status(500).json({ error: `Falha ao excluir usuário: ${detail}` });
  }
});

export default router;
