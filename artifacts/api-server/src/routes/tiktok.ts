import crypto from "crypto";
import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, tiktokConfig, userTiktokConnections } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";
import {
  generateTikTokOAuthUrl,
  exchangeTikTokCode,
  getTikTokUserInfo,
} from "../lib/tiktok.js";
import {
  getTiktokConnection,
  saveTiktokConnection,
  disconnectTiktok,
} from "../services/platforms/tiktokConnectionService.js";

function getFrontendBase(): string {
  const basePath = process.env.BASE_PATH ?? "";
  const domain = process.env.APP_CUSTOM_DOMAIN
    ?? process.env.REPLIT_DOMAINS?.split(",")[0]?.trim();
  if (domain) return `https://${domain}${basePath}`;
  return `http://localhost:80${basePath}`;
}

const router: IRouter = Router();

// ─── USER: Connection status ─────────────────────────────────────────────────
router.get("/tiktok/me/status", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;

  const [config] = await db.select().from(tiktokConfig).limit(1);
  const platformConfigured = !!(
    config?.clientKey &&
    config?.clientSecret &&
    config?.redirectUri &&
    config?.isActive
  );

  const conn = await getTiktokConnection(clerkUserId);
  if (!conn) {
    res.json({ connected: false, platformConfigured });
    return;
  }

  const meta = (conn.metadata as Record<string, unknown>) ?? {};

  res.json({
    connected: true,
    platformConfigured,
    connectionId: conn.id,
    openId: conn.platformUserId || null,
    displayName: conn.platformUsername || null,
    avatarUrl: (meta.avatar_url as string | null) ?? null,
    connectedAt: conn.createdAt,
    expiresAt: conn.expiresAt ?? null,
  });
});

// ─── USER: Start OAuth — redirect browser to TikTok ──────────────────────────
router.get("/tiktok/oauth/start", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const frontendBase = getFrontendBase();

  const [config] = await db.select().from(tiktokConfig).limit(1);
  if (!config?.clientKey || !config?.clientSecret || !config?.redirectUri) {
    res.redirect(
      `${frontendBase}/dashboard/tiktok?tiktok_error=${encodeURIComponent(
        "TikTok não configurado. Solicite ao administrador que configure as credenciais na aba Integrações.",
      )}`,
    );
    return;
  }

  const secret = process.env.SESSION_SECRET ?? "iattom_tiktok_state";
  const stateHmac = crypto.createHmac("sha256", secret).update(clerkUserId).digest("hex");
  const state = `${stateHmac}.${clerkUserId}`;

  const authUrl = generateTikTokOAuthUrl(config.clientKey, config.redirectUri, state);

  req.log.info({ clerkUserId }, "tiktok: starting OAuth flow");
  res.redirect(authUrl);
});

// ─── USER: OAuth callback — receives code + state from TikTok ────────────────
router.get("/tiktok/oauth/callback", async (req, res): Promise<void> => {
  const frontendBase = getFrontendBase();
  const { code, state, error, error_description } = req.query as Record<string, string>;

  if (error) {
    res.redirect(
      `${frontendBase}/dashboard/tiktok?tiktok_error=${encodeURIComponent(
        error_description ?? error,
      )}`,
    );
    return;
  }

  if (!code || !state || !state.includes(".")) {
    res.redirect(
      `${frontendBase}/dashboard/tiktok?tiktok_error=${encodeURIComponent(
        "Parâmetros inválidos no callback TikTok.",
      )}`,
    );
    return;
  }

  const dotIdx = state.indexOf(".");
  const receivedHmac = state.slice(0, dotIdx);
  const clerkUserId = state.slice(dotIdx + 1);

  if (!clerkUserId || !receivedHmac) {
    res.redirect(
      `${frontendBase}/dashboard/tiktok?tiktok_error=${encodeURIComponent(
        "Estado de segurança inválido.",
      )}`,
    );
    return;
  }

  const secret = process.env.SESSION_SECRET ?? "iattom_tiktok_state";
  const expectedHmac = crypto.createHmac("sha256", secret).update(clerkUserId).digest("hex");
  if (
    !crypto.timingSafeEqual(
      Buffer.from(receivedHmac, "hex"),
      Buffer.from(expectedHmac, "hex"),
    )
  ) {
    res.redirect(
      `${frontendBase}/dashboard/tiktok?tiktok_error=${encodeURIComponent(
        "Estado de segurança inválido. Tente novamente.",
      )}`,
    );
    return;
  }

  const [config] = await db.select().from(tiktokConfig).limit(1);
  if (!config?.clientKey || !config?.clientSecret || !config?.redirectUri) {
    res.redirect(
      `${frontendBase}/dashboard/tiktok?tiktok_error=${encodeURIComponent(
        "Credenciais TikTok não encontradas.",
      )}`,
    );
    return;
  }

  try {
    const tokenData = await exchangeTikTokCode(
      config.clientKey,
      config.clientSecret,
      code,
      config.redirectUri,
    );

    let displayName = tokenData.open_id;
    let avatarUrl: string | null = null;

    try {
      const userInfo = await getTikTokUserInfo(tokenData.access_token);
      displayName = userInfo.display_name || tokenData.open_id;
      avatarUrl = userInfo.avatar_url_100 ?? userInfo.avatar_url;
    } catch {
      // user info is best-effort — non-fatal
    }

    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000)
      : undefined;

    await saveTiktokConnection(clerkUserId, {
      platformUserId: tokenData.open_id,
      platformUsername: displayName,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt,
      scopes: tokenData.scope,
      metadata: { avatar_url: avatarUrl },
    });

    req.log.info({ clerkUserId, openId: tokenData.open_id }, "tiktok: user connected");
    res.redirect(`${frontendBase}/dashboard/tiktok?tiktok_connected=1`);
  } catch (err) {
    req.log.error({ err, clerkUserId }, "tiktok: oauth callback error");
    const msg =
      err instanceof Error ? err.message : "Falha na autenticação com TikTok. Tente novamente.";
    res.redirect(
      `${frontendBase}/dashboard/tiktok?tiktok_error=${encodeURIComponent(msg)}`,
    );
  }
});

// ─── ADMIN: All active TikTok user connections ────────────────────────────────
router.get("/tiktok/user-connections", requireAdmin, async (req, res): Promise<void> => {
  const rows = await db
    .select({
      id: userTiktokConnections.id,
      clerkUserId: userTiktokConnections.clerkUserId,
      platformUsername: userTiktokConnections.platformUsername,
      expiresAt: userTiktokConnections.expiresAt,
      createdAt: userTiktokConnections.createdAt,
    })
    .from(userTiktokConnections)
    .where(eq(userTiktokConnections.isActive, true))
    .orderBy(desc(userTiktokConnections.createdAt));

  res.json(
    rows.map((c) => ({
      id: c.id,
      clerkUserId: c.clerkUserId,
      displayName: c.platformUsername || null,
      expiresAt: c.expiresAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
    })),
  );
});

// ─── USER: Disconnect own TikTok account ─────────────────────────────────────
router.post("/tiktok/me/disconnect", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const conn = await getTiktokConnection(clerkUserId);
  if (conn) {
    await disconnectTiktok(clerkUserId, conn.id);
  }
  req.log.info({ clerkUserId }, "tiktok: user disconnected own account");
  res.json({ ok: true });
});

export default router;
