import { createHmac, timingSafeEqual } from "crypto";
import { LoggerManager } from "./LoggerManager.js";
import { NotificationManager } from "./NotificationManager.js";
import type { WebhookValidationResult, NormalizedEvent, IntegrationId } from "./types.js";
import { INTEGRATION_LABELS } from "./types.js";
import { randomUUID } from "crypto";

// ─── Event label maps ─────────────────────────────────────────────────────────

const HOTMART_EVENT_LABELS: Record<string, string> = {
  PURCHASE_APPROVED: "Compra Aprovada",
  PURCHASE_BILLET_PRINTED: "Boleto/Pix Gerado",
  PURCHASE_CANCELED: "Compra Cancelada",
  PURCHASE_CHARGEBACK: "Chargeback",
  PURCHASE_REFUNDED: "Reembolso",
  PURCHASE_ABANDONED: "Abandono de Checkout",
  PURCHASE_COMPLETE: "Compra Concluída",
  SUBSCRIPTION_ACTIVE: "Assinatura Ativada",
  SUBSCRIPTION_CANCELED: "Assinatura Cancelada",
  SUBSCRIPTION_REACTIVATED: "Assinatura Reativada",
};

const KIWIFY_EVENT_LABELS: Record<string, string> = {
  "order.approved": "Compra Aprovada",
  "order.waiting_payment": "Aguardando Pagamento",
  "order.refunded": "Reembolso",
  "order.chargeback": "Chargeback",
  "order.canceled": "Cancelado",
  "order.abandoned": "Abandono de Checkout",
  "subscription.active": "Assinatura Ativada",
  "subscription.canceled": "Assinatura Cancelada",
  "subscription.renewed": "Assinatura Renovada",
};

const WHATSAPP_EVENT_LABELS: Record<string, string> = {
  message: "Mensagem Recebida",
  status: "Status de Mensagem",
  read: "Mensagem Lida",
  delivered: "Mensagem Entregue",
  failed: "Envio Falhou",
};

const META_EVENT_LABELS: Record<string, string> = {
  messages: "Mensagem Recebida",
  comments: "Comentário",
  feed: "Publicação",
  mention: "Menção",
  story_mention: "Menção em Story",
};

const SHOPEE_EVENT_LABELS: Record<string, string> = {
  order_status: "Status do Pedido",
  shop_update: "Atualização da Loja",
  item_update: "Atualização de Produto",
  ban_item: "Produto Banido",
  cancel_order: "Pedido Cancelado",
  return_order: "Devolução",
};

const ML_EVENT_LABELS: Record<string, string> = {
  orders_v2: "Pedido",
  questions: "Pergunta",
  items: "Anúncio",
  payments: "Pagamento",
  messages: "Mensagem",
  shipments: "Envio",
};

// ─── Signature validation strategies ─────────────────────────────────────────

export const WebhookManager = new (class WebhookManagerImpl {

  // ─── WhatsApp: X-Hub-Signature-256 (HMAC-SHA256) ───────────────────────

  validateWhatsApp(body: Buffer | string, signature: string, appSecret: string): WebhookValidationResult {
    return this.validateHmacSha256(body, signature, appSecret, "sha256=", "whatsapp");
  }

  // ─── Meta (Facebook/Instagram): same as WhatsApp ───────────────────────

  validateMeta(body: Buffer | string, signature: string, appSecret: string): WebhookValidationResult {
    return this.validateHmacSha256(body, signature, appSecret, "sha256=", "meta");
  }

  // ─── Shopee: HMAC-SHA256(partnerId + apiPath + timestamp + accessToken) ─

  validateShopee(
    body: Buffer | string,
    receivedSignature: string,
    partnerKey: string,
    partnerId: string,
    apiPath: string,
    timestamp: number,
    accessToken = "",
  ): WebhookValidationResult {
    try {
      const baseStr = `${partnerId}${apiPath}${timestamp}${accessToken}`;
      const expected = createHmac("sha256", partnerKey).update(baseStr).digest("hex");
      return this.timingSafeCompare(expected, receivedSignature, "shopee");
    } catch (err) {
      return this.validationError("shopee", err);
    }
  }

  // ─── Hotmart: timing-safe token compare ────────────────────────────────

  validateHotmart(receivedToken: string, expectedToken: string): WebhookValidationResult {
    return this.timingSafeCompare(expectedToken, receivedToken, "hotmart");
  }

  // ─── Kiwify: HMAC-SHA1 of body ─────────────────────────────────────────

  validateKiwify(body: Buffer | string, signature: string, webhookSecret: string): WebhookValidationResult {
    try {
      const rawBody = typeof body === "string" ? Buffer.from(body) : body;
      const expected = createHmac("sha1", webhookSecret).update(rawBody).digest("hex");
      return this.timingSafeCompare(expected, signature, "kiwify");
    } catch (err) {
      return this.validationError("kiwify", err);
    }
  }

  // ─── Mercado Livre: no webhook signature (URL-token auth only) ─────────

  validateML(): WebhookValidationResult {
    return { valid: true };
  }

  // ─── Generic HMAC-SHA256 helper ─────────────────────────────────────────

  private validateHmacSha256(
    body: Buffer | string,
    signature: string,
    secret: string,
    prefix: string,
    integration: IntegrationId,
  ): WebhookValidationResult {
    try {
      const rawBody = typeof body === "string" ? Buffer.from(body) : body;
      const hash = createHmac("sha256", secret).update(rawBody).digest("hex");
      const expected = `${prefix}${hash}`;
      return this.timingSafeCompare(expected, signature, integration);
    } catch (err) {
      return this.validationError(integration, err);
    }
  }

  private timingSafeCompare(
    expected: string,
    received: string,
    integration: IntegrationId,
  ): WebhookValidationResult {
    try {
      const a = Buffer.from(expected);
      const b = Buffer.from(received.padEnd(expected.length, "\0").slice(0, expected.length));
      const valid = a.length === b.length && timingSafeEqual(a, b);

      if (!valid) {
        LoggerManager.warn(
          `WebhookManager: invalid signature for ${integration}`,
          integration,
        );
        NotificationManager.webhookError(
          integration,
          `Assinatura inválida recebida — possível requisição não autorizada.`,
        );
      }

      return { valid };
    } catch (err) {
      return this.validationError(integration, err);
    }
  }

  private validationError(integration: IntegrationId, err: unknown): WebhookValidationResult {
    const msg = err instanceof Error ? err.message : String(err);
    LoggerManager.error(`WebhookManager: validation error for ${integration}: ${msg}`, integration);
    return { valid: false, errorMessage: msg };
  }

  // ─── Event normalization per platform ────────────────────────────────────

  normalizeHotmart(raw: Record<string, unknown>): Omit<NormalizedEvent, "id" | "receivedAt" | "status"> {
    const event = raw["event"] as string | undefined;
    const data = (raw["data"] as Record<string, unknown>) ?? {};
    const buyer = (data["buyer"] as Record<string, unknown>) ?? {};
    const purchase = (data["purchase"] as Record<string, unknown>) ?? {};
    const product = (data["product"] as Record<string, unknown>) ?? {};

    return {
      integrationId: "hotmart",
      platformLabel: INTEGRATION_LABELS.hotmart,
      eventType: event ?? "unknown",
      eventLabel: HOTMART_EVENT_LABELS[event ?? ""] ?? event ?? "Evento",
      primaryText: (buyer["name"] as string) ?? null,
      secondaryText: (buyer["email"] as string) ?? (purchase["transaction"] as string) ?? null,
      value: String((purchase["price"] as Record<string, unknown>)?.["value"] ?? ""),
      currency: String((purchase["price"] as Record<string, unknown>)?.["currency_value"] ?? "BRL"),
      rawPayload: raw,
    };
  }

  normalizeKiwify(raw: Record<string, unknown>): Omit<NormalizedEvent, "id" | "receivedAt" | "status"> {
    const event = raw["order_status"] as string | undefined ?? raw["event"] as string | undefined;
    const customer = (raw["Customer"] as Record<string, unknown>) ?? {};

    return {
      integrationId: "kiwify",
      platformLabel: INTEGRATION_LABELS.kiwify,
      eventType: event ?? "unknown",
      eventLabel: KIWIFY_EVENT_LABELS[event ?? ""] ?? event ?? "Evento",
      primaryText: (customer["full_name"] as string) ?? null,
      secondaryText: (customer["email"] as string) ?? (raw["order_id"] as string) ?? null,
      value: String(raw["order_total"] ?? ""),
      currency: "BRL",
      rawPayload: raw,
    };
  }

  normalizeWhatsApp(raw: Record<string, unknown>): Omit<NormalizedEvent, "id" | "receivedAt" | "status"> {
    const entry = ((raw["entry"] as unknown[]) ?? [])[0] as Record<string, unknown> | undefined;
    const changes = ((entry?.["changes"] as unknown[]) ?? [])[0] as Record<string, unknown> | undefined;
    const value = (changes?.["value"] as Record<string, unknown>) ?? {};
    const message = ((value["messages"] as unknown[]) ?? [])[0] as Record<string, unknown> | undefined;
    const contact = ((value["contacts"] as unknown[]) ?? [])[0] as Record<string, unknown> | undefined;
    const msgType = message?.["type"] as string | undefined;

    return {
      integrationId: "whatsapp",
      platformLabel: INTEGRATION_LABELS.whatsapp,
      eventType: msgType ?? "message",
      eventLabel: WHATSAPP_EVENT_LABELS[msgType ?? "message"] ?? "Mensagem",
      primaryText: (contact?.["profile"] as Record<string, unknown>)?.["name"] as string ?? null,
      secondaryText: message?.["from"] as string ?? null,
      value: null,
      currency: null,
      rawPayload: raw,
    };
  }

  normalizeMeta(raw: Record<string, unknown>, platform: "facebook" | "instagram" = "facebook"): Omit<NormalizedEvent, "id" | "receivedAt" | "status"> {
    const entry = ((raw["entry"] as unknown[]) ?? [])[0] as Record<string, unknown> | undefined;
    const changes = ((entry?.["changes"] as unknown[]) ?? [])[0] as Record<string, unknown> | undefined;
    const field = changes?.["field"] as string | undefined;

    return {
      integrationId: "meta",
      platformLabel: platform === "instagram" ? "Instagram" : "Facebook",
      eventType: field ?? "event",
      eventLabel: META_EVENT_LABELS[field ?? ""] ?? field ?? "Evento",
      primaryText: entry?.["id"] as string ?? null,
      secondaryText: null,
      value: null,
      currency: null,
      rawPayload: raw,
    };
  }

  normalizeShopee(raw: Record<string, unknown>): Omit<NormalizedEvent, "id" | "receivedAt" | "status"> {
    const code = raw["code"] as number | undefined;
    const codeStr = String(code ?? "");

    return {
      integrationId: "shopee",
      platformLabel: INTEGRATION_LABELS.shopee,
      eventType: codeStr,
      eventLabel: SHOPEE_EVENT_LABELS[codeStr] ?? `Código ${codeStr}`,
      primaryText: String(raw["shop_id"] ?? ""),
      secondaryText: null,
      value: null,
      currency: null,
      rawPayload: raw,
    };
  }

  normalizeML(raw: Record<string, unknown>): Omit<NormalizedEvent, "id" | "receivedAt" | "status"> {
    const topic = raw["topic"] as string | undefined;
    const resource = raw["resource"] as string | undefined;

    return {
      integrationId: "ml",
      platformLabel: INTEGRATION_LABELS.ml,
      eventType: topic ?? "notification",
      eventLabel: ML_EVENT_LABELS[topic ?? ""] ?? topic ?? "Notificação",
      primaryText: resource ?? null,
      secondaryText: String(raw["user_id"] ?? ""),
      value: null,
      currency: null,
      rawPayload: raw,
    };
  }

  // ─── Build full NormalizedEvent ──────────────────────────────────────────

  buildEvent(
    partial: Omit<NormalizedEvent, "id" | "receivedAt" | "status">,
  ): NormalizedEvent {
    return {
      ...partial,
      id: randomUUID(),
      receivedAt: new Date(),
      status: "received",
    };
  }
})();
