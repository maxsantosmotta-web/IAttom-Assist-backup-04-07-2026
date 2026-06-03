import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { eq, desc, isNull, sql, and } from "drizzle-orm";
import {
  db,
  mlConfig,
  mlProducts,
  mlEvents,
  trashItems,
  userMlConnections,
} from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth.js";
import {
  generateMLOAuthUrl,
  getMLItems,
  createMLItem,
  MLApiError,
} from "../lib/mercadolivre.js";

const router: IRouter = Router();

// ─── Helper: get active connection for the authenticated user ─────────────────
async function getUserConnection(clerkUserId: string) {
  const [conn] = await db
    .select()
    .from(userMlConnections)
    .where(
      and(
        eq(userMlConnections.clerkUserId, clerkUserId),
        eq(userMlConnections.isActive, true),
      ),
    )
    .limit(1);
  return conn ?? null;
}

// ─── GET /me/ml/status — per-user connection status ───────────────────────────
router.get("/me/ml/status", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const conn = await getUserConnection(clerkUserId);

  // Read app config from mlConfig only to check if OAuth is set up (appId)
  const [config] = await db
    .select({ appId: mlConfig.appId })
    .from(mlConfig)
    .limit(1);

  res.json({
    connected:    !!conn,
    nickname:     conn?.platformUsername ?? null,
    tokenExpired: conn?.expiresAt ? new Date(conn.expiresAt) < new Date() : false,
    appConfigured: !!(config?.appId),
    siteId:       null,
  });
});

// ─── GET /me/ml/oauth-url — generates OAuth URL with user state ───────────────
router.get("/me/ml/oauth-url", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const [config] = await db.select().from(mlConfig).limit(1);
  if (!config?.appId || !config.redirectUri) {
    res.status(503).json({ error: "Integração ML não configurada pelo administrador." });
    return;
  }
  // Encode clerkUserId in state so the callback knows which user to save tokens for
  const url = generateMLOAuthUrl(config.appId, config.redirectUri, `user:${clerkUserId}`);
  res.json({ url });
});

// ─── GET /me/ml/listings — only this user's synced products ───────────────────
router.get("/me/ml/listings", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const items = await db
    .select()
    .from(mlProducts)
    .where(
      and(
        eq(mlProducts.clerkUserId, clerkUserId),
        isNull(mlProducts.deletedAt),
      ),
    )
    .orderBy(desc(mlProducts.syncedAt))
    .limit(100);
  res.json(items);
});

// ─── GET /me/ml/events — webhook events (platform-level, read-only) ───────────
router.get("/me/ml/events", requireAuth, async (_req, res): Promise<void> => {
  const events = await db
    .select()
    .from(mlEvents)
    .orderBy(desc(mlEvents.id))
    .limit(30);
  res.json(events);
});

// ─── POST /me/ml/sync — sync using the user's own access token ───────────────
router.post("/me/ml/sync", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const conn = await getUserConnection(clerkUserId);

  if (!conn) {
    res.status(503).json({ error: "Conecte sua conta Mercado Livre antes de continuar." });
    return;
  }
  if (!conn.platformUserId) {
    res.status(503).json({ error: "User ID não disponível. Reconecte sua conta Mercado Livre." });
    return;
  }

  try {
    const items = await getMLItems(conn.accessToken, conn.platformUserId);
    let synced = 0;
    for (const item of items) {
      await db
        .insert(mlProducts)
        .values({
          mlItemId:          item.id,
          title:             item.title             ?? "",
          price:             String(item.price      ?? "0"),
          availableQuantity: item.available_quantity ?? 0,
          status:            item.status            ?? "unknown",
          categoryId:        item.category_id       ?? "",
          permalink:         item.permalink         ?? "",
          clerkUserId,
          syncedAt:          new Date(),
        })
        .onConflictDoUpdate({
          target: mlProducts.mlItemId,
          set: {
            title:             item.title             ?? "",
            price:             String(item.price      ?? "0"),
            availableQuantity: item.available_quantity ?? 0,
            status:            item.status            ?? "unknown",
            clerkUserId,
            syncedAt:          sql`now()`,
          },
        });
      synced++;
    }
    res.json({ ok: true, synced });
  } catch (err) {
    req.log.error({ err }, "me/ml/sync: failed");
    if (err instanceof MLApiError && err.isUnauthorized) {
      res.status(401).json({ error: "Token expirado. Reconecte sua conta Mercado Livre." });
    } else {
      res.status(500).json({ error: err instanceof Error ? err.message : "Falha na sincronização" });
    }
  }
});

// ─── POST /me/ml/listings/:id/trash ──────────────────────────────────────────
router.post("/me/ml/listings/:id/trash", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const id = parseInt(req.params["id"] as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  // Only allow trashing products owned by this user
  const [product] = await db
    .select()
    .from(mlProducts)
    .where(and(eq(mlProducts.id, id), eq(mlProducts.clerkUserId, clerkUserId)))
    .limit(1);
  if (!product) { res.status(404).json({ error: "Anúncio não encontrado" }); return; }

  await db.update(mlProducts).set({ deletedAt: new Date() }).where(eq(mlProducts.id, id));
  await db.insert(trashItems).values({
    originalId:     id,
    platform:       "mercado_livre",
    itemType:       "listing",
    name:           product.title ?? "Anúncio sem título",
    previousStatus: product.status ?? "active",
    snapshot:       JSON.stringify(product),
    clerkUserId,
    deletedAt:      new Date(),
  });

  res.json({ ok: true });
});

// ─── Schema: POST /me/ml/create-listing ──────────────────────────────────────
// Supports both legacy calls ({ title, price, quantity }) and full ML payloads.
// All fields are optional; safe defaults are applied below.
const createListingSchema = z.object({
  title:              z.string().min(1).optional(),
  price:              z.number().positive().optional(),
  quantity:           z.number().int().positive().optional(),
  available_quantity: z.number().int().positive().optional(),
  category_id:        z.string().optional(),
  condition:          z.enum(["new", "used"]).optional(),
  listing_type_id:    z.string().optional(),
  description:        z.string().optional(),
  pictures:           z.array(z.object({ source: z.string() })).optional(),
  attributes:         z.array(z.object({ id: z.string(), value_name: z.string() })).optional(),
  shipping: z.object({
    mode:          z.string(),
    local_pick_up: z.boolean().optional(),
    free_shipping: z.boolean().optional(),
  }).optional(),
});

// ─── POST /me/ml/create-listing — use user's own access token ─────────────────
router.post("/me/ml/create-listing", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const conn = await getUserConnection(clerkUserId);

  if (!conn) {
    res.status(503).json({ error: "Conecte sua conta Mercado Livre antes de continuar." });
    return;
  }

  const parsed = createListingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Payload inválido.", issues: parsed.error.issues });
    return;
  }

  const body = parsed.data;

  // Resolve quantity — accept both legacy "quantity" and ML-native "available_quantity"
  const qty = body.available_quantity ?? body.quantity ?? 1;

  // Resolve title for default attributes fallback
  const resolvedTitle = body.title ?? "Novo Anúncio";

  try {
    const item = await createMLItem(conn.accessToken, {
      title:              resolvedTitle,
      category_id:        body.category_id        ?? "MLB3530",
      price:              body.price               ?? 10,
      currency_id:        "BRL",
      available_quantity: qty,
      listing_type_id:    body.listing_type_id     ?? "free",
      condition:          body.condition           ?? "new",
      // If caller supplies description, forward it to ML API
      ...(body.description && { description: body.description }),
      // If caller supplies pictures, use them; otherwise keep the safe placeholder
      pictures: body.pictures ?? [
        { source: "https://http2.mlstatic.com/frontend-assets/ui-navigation/5.19.1/mercadolivre/logo__large_plus.png" },
      ],
      // If caller supplies attributes, use them; otherwise apply minimal fallback
      attributes: body.attributes ?? [
        { id: "BRAND", value_name: "Minha Marca"   },
        { id: "MODEL", value_name: resolvedTitle    },
      ],
      // If caller supplies shipping config, use it; otherwise apply safe default
      shipping: body.shipping ?? {
        mode:          "not_specified",
        local_pick_up: true,
        free_shipping: false,
      },
    });

    if (item.id) {
      await db
        .insert(mlProducts)
        .values({
          mlItemId:          item.id,
          title:             item.title               ?? resolvedTitle,
          price:             String(body.price        ?? 10),
          availableQuantity: qty,
          status:            item.status              ?? "active",
          categoryId:        body.category_id         ?? "MLB3530",
          permalink:         item.permalink           ?? "",
          clerkUserId,
          syncedAt:          new Date(),
        })
        .onConflictDoUpdate({
          target: mlProducts.mlItemId,
          set: {
            title:      item.title     ?? "",
            status:     item.status    ?? "active",
            permalink:  item.permalink ?? "",
            clerkUserId,
            syncedAt:   sql`now()`,
          },
        });
    }

    res.json({ ok: true, item: { id: item.id, permalink: item.permalink } });
  } catch (err) {
    req.log.error({ err }, "me/ml/create-listing: failed");
    if (err instanceof MLApiError && err.isUnauthorized) {
      res.status(401).json({ error: "Token expirado. Reconecte sua conta Mercado Livre." });
    } else if (err instanceof MLApiError && err.isForbidden) {
      res.status(403).json({ error: "Sem permissão. Verifique os escopos do app no painel ML." });
    } else if (err instanceof MLApiError) {
      let cause: { cause?: Array<{ code: number; message: string }> } = {};
      try { cause = JSON.parse(err.body) as typeof cause; } catch { /* ignore */ }
      const detail = (cause.cause ?? []).map((c) => c.message).filter(Boolean).join(" | ");
      res.status(422).json({ error: detail || err.message });
    } else {
      res.status(500).json({ error: err instanceof Error ? err.message : "Falha ao criar anúncio" });
    }
  }
});

// ─── Schema: POST /me/ml/upload-picture ──────────────────────────────────────
const uploadPictureSchema = z.object({
  base64:   z.string().min(1),
  mimeType: z.string().optional(),
  filename: z.string().optional(),
});

const VALID_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"]);

// ─── POST /me/ml/upload-picture — upload base64 image to ML and return URL ────
// Usage: POST { base64, mimeType?, filename? }
// Returns: { ok, pictureId, url }
// The returned `url` is passed as pictures[].source in POST /me/ml/create-listing
router.post("/me/ml/upload-picture", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const conn = await getUserConnection(clerkUserId);

  if (!conn) {
    res.status(503).json({ error: "Conecte sua conta Mercado Livre antes de continuar." });
    return;
  }

  const parsed = uploadPictureSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Payload inválido.", issues: parsed.error.issues });
    return;
  }

  const {
    base64: rawBase64,
    mimeType = "image/png",
    filename = "image.png",
  } = parsed.data;

  if (!VALID_MIME_TYPES.has(mimeType)) {
    res.status(400).json({
      error: `Tipo de imagem inválido: ${mimeType}. Use image/png, image/jpeg ou image/webp.`,
    });
    return;
  }

  // Strip "data:image/...;base64," prefix if the caller sends a data URL
  const b64 = rawBase64.includes(",") ? (rawBase64.split(",")[1] ?? "") : rawBase64;
  const buffer = Buffer.from(b64, "base64");

  if (buffer.length === 0) {
    res.status(400).json({ error: "Imagem inválida ou vazia." });
    return;
  }

  try {
    // Build multipart/form-data — Node 24 native FormData + Blob
    const formData = new FormData();
    const blob = new Blob([buffer], { type: mimeType });
    formData.append("file", blob, filename);

    // ML Pictures API — do NOT set Content-Type header manually (fetch sets the boundary)
    const mlRes = await fetch("https://api.mercadolibre.com/pictures", {
      method:  "POST",
      headers: { Authorization: `Bearer ${conn.accessToken}` },
      body:    formData,
    });

    interface MLPictureResponse {
      id?:          string;
      url?:         string;
      secure_url?:  string;
      error?:       string;
      message?:     string;
      status?:      string;
    }

    const data = await mlRes.json() as MLPictureResponse;

    if (!mlRes.ok) {
      const errMsg = data.message ?? data.error ?? `ML API ${mlRes.status}`;
      req.log.warn({ status: mlRes.status, errMsg }, "me/ml/upload-picture: ML returned error");

      if (mlRes.status === 401) {
        res.status(401).json({ error: "Token expirado. Reconecte sua conta Mercado Livre." });
      } else if (mlRes.status === 403) {
        res.status(403).json({ error: "Sem permissão para upload de imagens. Verifique os escopos do app." });
      } else {
        res.status(mlRes.status >= 400 && mlRes.status < 500 ? 422 : 500).json({ error: errMsg });
      }
      return;
    }

    if (!data.id) {
      req.log.warn({ data }, "me/ml/upload-picture: no picture id in ML response");
      res.status(502).json({ error: "Mercado Livre não retornou ID da imagem." });
      return;
    }

    req.log.info({ pictureId: data.id, clerkUserId }, "me/ml/upload-picture: success");

    res.json({
      ok:        true,
      pictureId: data.id,
      url:       data.secure_url ?? data.url ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "me/ml/upload-picture: failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Falha no upload de imagem" });
  }
});

// ─── GET /me/ml/category-suggest — proxy ML domain_discovery, returns suggestions ─
// Usage: GET /me/ml/category-suggest?q=<product+title>
// Returns: { ok, query, suggestions: [{ category_id, category_name, domain_id?, domain_name? }] }
// The frontend uses this to pre-fill category_id in the review form before calling create-listing.
router.get("/me/ml/category-suggest", requireAuth, async (req, res): Promise<void> => {
  const q = (req.query["q"] as string | undefined)?.trim() ?? "";

  if (q.length < 2) {
    res.status(400).json({ error: "Parâmetro 'q' deve ter pelo menos 2 caracteres." });
    return;
  }

  const { clerkUserId } = req as AuthenticatedRequest;
  const conn = await getUserConnection(clerkUserId);

  // ML domain_discovery is a public endpoint but benefits from a user token when available
  const authHeader = conn ? { Authorization: `Bearer ${conn.accessToken}` } : {};

  try {
    interface MLDomainSuggestion {
      domain_id?:     string;
      domain_name?:   string;
      category_id?:   string;
      category_name?: string;
    }

    const url = `https://api.mercadolibre.com/sites/MLB/domain_discovery/search?q=${encodeURIComponent(q)}&limit=5`;
    const mlRes = await fetch(url, { headers: authHeader });

    if (!mlRes.ok) {
      const body = await mlRes.text().catch(() => "");
      req.log.warn({ status: mlRes.status, q }, "me/ml/category-suggest: ML returned error");

      if (mlRes.status === 401) {
        res.status(401).json({ error: "Token expirado. Reconecte sua conta Mercado Livre." });
      } else if (mlRes.status === 403) {
        res.status(403).json({ error: "Sem permissão para consultar categorias." });
      } else {
        res.status(mlRes.status >= 400 && mlRes.status < 500 ? 422 : 502).json({
          error: `ML API ${mlRes.status}${body ? `: ${body.slice(0, 200)}` : ""}`,
        });
      }
      return;
    }

    const raw = await mlRes.json() as MLDomainSuggestion[];
    const suggestions = Array.isArray(raw)
      ? raw
          .filter((s) => s.category_id)
          .map((s) => ({
            category_id:   s.category_id  ?? "",
            category_name: s.category_name ?? s.category_id ?? "",
            domain_id:     s.domain_id    ?? null,
            domain_name:   s.domain_name  ?? null,
          }))
      : [];

    req.log.info({ q, count: suggestions.length }, "me/ml/category-suggest: ok");
    res.json({ ok: true, query: q, suggestions });
  } catch (err) {
    req.log.error({ err }, "me/ml/category-suggest: failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Falha ao consultar categorias" });
  }
});

// ─── GET /me/ml/listing-types — valid listing types for a category ────────────
// Usage: GET /me/ml/listing-types?category_id=<optional>
// Returns: { ok, listing_type_id: string | null, available: [{ id, name }] }
// The frontend uses this to pick the best valid listing_type_id before calling create-listing.
router.get("/me/ml/listing-types", requireAuth, async (req, res): Promise<void> => {
  const categoryId = (req.query["category_id"] as string | undefined)?.trim() ?? "";
  const { clerkUserId } = req as AuthenticatedRequest;
  const conn = await getUserConnection(clerkUserId);

  const authHeader: Record<string, string> = conn
    ? { Authorization: `Bearer ${conn.accessToken}` }
    : {};

  const url = categoryId
    ? `https://api.mercadolibre.com/categories/${encodeURIComponent(categoryId)}/listing_types`
    : `https://api.mercadolibre.com/sites/MLB/listing_types`;

  try {
    interface MLListingType {
      id?:              string;
      name?:            string;
      listing_type_id?: string;
    }

    const mlRes = await fetch(url, { headers: authHeader });

    if (!mlRes.ok) {
      req.log.warn({ status: mlRes.status, categoryId }, "me/ml/listing-types: ML returned error");
      res.status(mlRes.status >= 400 && mlRes.status < 500 ? 422 : 502).json({
        error: `ML API ${mlRes.status}`,
      });
      return;
    }

    const raw = await mlRes.json() as MLListingType[];
    const available = Array.isArray(raw)
      ? raw
          .map((t) => ({ id: t.id ?? t.listing_type_id ?? "", name: t.name ?? t.id ?? "" }))
          .filter((t) => !!t.id)
      : [];

    // Pick best type in priority order
    const PRIORITY = ["gold_special", "gold_pro", "free"];
    const ids = available.map((t) => t.id);
    const best = PRIORITY.find((p) => ids.includes(p)) ?? available[0]?.id ?? null;

    req.log.info({ categoryId, best, count: available.length }, "me/ml/listing-types: ok");
    res.json({ ok: true, listing_type_id: best, available });
  } catch (err) {
    req.log.error({ err }, "me/ml/listing-types: failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Falha ao consultar tipos de anuncio" });
  }
});

// ─── POST /me/ml/disconnect — deactivate only this user's connection ──────────
router.post("/me/ml/disconnect", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  await db
    .update(userMlConnections)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(userMlConnections.clerkUserId, clerkUserId));
  req.log.info({ clerkUserId }, "ml: user disconnected own account");
  res.json({ ok: true });
});

export default router;
