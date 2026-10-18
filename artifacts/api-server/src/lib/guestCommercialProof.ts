/**
 * Landing registration HMAC proof. Not payment evidence.
 * Cardpayer email never determines the subscription owner.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const GUEST_MONTHLY = Object.freeze({
  START: Object.freeze({ priceId: "price_1TunJ2AYtu5nLhAZPd1Ai0hD", cents: 6900, planKey: "pro", credits: 200 }),
  PREMIUM: Object.freeze({ priceId: "price_1TunQhAYtu5nLhAZu5QXWW31", cents: 15900, planKey: "business", credits: 500 }),
  PRO: Object.freeze({ priceId: "price_1TunTDAYtu5nLhAZDfzTn8Cm", cents: 29900, planKey: "agency", credits: 1000 }),
} as const);
export type GuestCommercialPlan = keyof typeof GUEST_MONTHLY;
type Metadata = Record<string, string | undefined>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeVerifiedEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalized)
    ? normalized : null;
}
function signingKey(secret: unknown): Buffer | null {
  if (typeof secret !== "string" || !/^[0-9a-f]{64,128}$/i.test(secret) ||
      secret.length % 2) return null;
  return Buffer.from(secret, "hex");
}
export function signGuestRegistration(input: {
  registrationId: string; plan: GuestCommercialPlan; verifiedRegistrationEmail: string;
  issuedAt: number; sharedSigningKey: string;
}): string {
  const key = signingKey(input.sharedSigningKey);
  const email = normalizeVerifiedEmail(input.verifiedRegistrationEmail);
  if (!key || !email || !UUID.test(input.registrationId) ||
      !Object.hasOwn(GUEST_MONTHLY, input.plan) ||
      !Number.isSafeInteger(input.issuedAt) || input.issuedAt <= 0)
    throw new Error("Invalid trusted preregistration");
  const spec = GUEST_MONTHLY[input.plan];
  const data = ["iattom-commercial-v1", input.registrationId.toLowerCase(),
    input.plan, spec.priceId, email, String(input.issuedAt)].join("\n");
  return createHmac("sha256", key).update(data).digest("hex");
}
export type ProofDecision =
  | { ok: true; plan: GuestCommercialPlan; priceId: string; planKey: "pro" | "business" | "agency";
      credits: number; registrationId: string }
  | { ok: false; code: string };
export function validateGuestRegistrationProof(input: {
  metadata: Metadata | null | undefined; clerkPrimaryEmail: string;
  checkoutCreated: number; sharedSigningKey: string; nowSeconds: number;
}): ProofDecision {
  const reject = (code: string): ProofDecision => ({ ok: false, code });
  if (!signingKey(input.sharedSigningKey)) return reject("SIGNING_KEY_NOT_CONFIGURED");
  const m = input.metadata ?? {};
  const candidate = m.plan;
  if (m.commercial_source !== "landing" || !candidate || !Object.hasOwn(GUEST_MONTHLY,candidate) ||
      !m.pre_registration_id || !UUID.test(m.pre_registration_id) ||
      !m.pre_registration_issued_at || !/^\d{10}$/.test(m.pre_registration_issued_at) ||
      !m.pre_registration_proof || !/^[a-f0-9]{64}$/i.test(m.pre_registration_proof))
    return reject("INVALID_REGISTRATION_METADATA");
  const mail = normalizeVerifiedEmail(input.clerkPrimaryEmail);
  if (!mail) return reject("VERIFIED_CLERK_EMAIL_REQUIRED");
  const issued = Number(m.pre_registration_issued_at);
  if (!Number.isSafeInteger(input.checkoutCreated) || !Number.isSafeInteger(input.nowSeconds) ||
      issued < input.checkoutCreated - 86400 || issued > input.checkoutCreated + 300 ||
      issued > input.nowSeconds + 300 || input.nowSeconds < input.checkoutCreated - 300)
    return reject("REGISTRATION_PROOF_OUTSIDE_WINDOW");
  const plan = candidate as GuestCommercialPlan;
  const expected = signGuestRegistration({ registrationId:m.pre_registration_id,plan,
    verifiedRegistrationEmail:mail,issuedAt:issued,sharedSigningKey:input.sharedSigningKey });
  if (!timingSafeEqual(Buffer.from(expected,"hex"),Buffer.from(m.pre_registration_proof,"hex")))
    return reject("VERIFIED_CLERK_EMAIL_NOT_MATCHED");
  const spec = GUEST_MONTHLY[plan];
  if (m.planKey !== spec.planKey) return reject("INTERNAL_PLAN_MISMATCH");
  return { ok:true,plan,priceId:spec.priceId,planKey:spec.planKey,credits:spec.credits,
    registrationId:m.pre_registration_id.toLowerCase() };
}
