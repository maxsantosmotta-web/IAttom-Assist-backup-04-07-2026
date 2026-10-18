/**
 * Trust boundary: call ONLY after retrieving Stripe objects on the server, and
 * after the webhook signature has been verified when handling webhook events.
 * Does not require a Clerk user. A purchase must survive until the user logs in.
 * HMAC e-mail binding is deferred to the authenticated claim.
 */
import {GUEST_MONTHLY, type GuestCommercialPlan} from "./guestCommercialProof.js";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type VerifiedPaidGuest={
 ok:true;sessionId:string;subscriptionId:string;customerId:string;invoiceId:string;
 registrationId:string;plan:GuestCommercialPlan;planKey:"pro"|"business"|"agency";
 priceId:string;credits:number;sessionCreated:number;
 issuedAt:number;hmac:string;periodStart:number;periodEnd:number;
};
export type PaidGuestDecision=VerifiedPaidGuest|{ok:false;code:string};
export function assessStripePaidGuestWithoutClerk(a:{
 session:{id:string;livemode:boolean;status:string|null;paymentStatus:string;mode:string;
  customer:string;subscriptionId:string;created:number;currency:string|null;
  amountTotal:number|null;clientReferenceId:string|null;metadata:Record<string,string|undefined>};
 subscription:{id:string;livemode:boolean;status:string;customer:string;metadata:Record<string,string|undefined>;
  prices:Array<{id:string;currency:string;amount:number|null;interval:string|null}>;
  invoiceId:string;periodStart:number;periodEnd:number};
 invoice:{id:string;livemode:boolean;status:string|null;customer:string;
  subscriptionId:string;currency:string;amountPaid:number};
}):PaidGuestDecision{
 const reject=(code:string):PaidGuestDecision=>({ok:false,code});
 const {session:s,subscription:sub,invoice:i}=a;
 if(!s||!s.id.startsWith("cs_live_")||!s.livemode||s.status!=="complete"||
   s.mode!=="subscription"||s.paymentStatus!=="paid"||
   !s.customer.startsWith("cus_")||!s.subscriptionId.startsWith("sub_")||
   !sub||!sub.livemode||sub.status!=="active"||
   sub.customer!==s.customer||sub.id!==s.subscriptionId)
  return reject("STRIPE_PAID_ACTIVE_PURCHASE_REQUIRED");
 const m=s.metadata??{},plan=m.plan;
 if(m.commercial_source!=="landing"||!plan||!Object.hasOwn(GUEST_MONTHLY,plan)||
    !m.pre_registration_id||!UUID.test(m.pre_registration_id)||
    m.pre_registration_id!==s.clientReferenceId||
    !m.pre_registration_proof||!/^[a-f0-9]{64}$/.test(m.pre_registration_proof)||
    !m.pre_registration_issued_at||! /^\d{10}$/.test(m.pre_registration_issued_at))
  return reject("LANDING_SIGNED_REFERENCE_MISSING");
 const spec=GUEST_MONTHLY[plan as GuestCommercialPlan];
 if(m.planKey!==spec.planKey||
    sub.metadata?.commercial_source!=="landing"||
    sub.metadata?.pre_registration_id!==m.pre_registration_id||
    sub.metadata?.plan!==plan||sub.metadata?.planKey!==spec.planKey||
    sub.metadata?.pre_registration_proof!==m.pre_registration_proof||
    sub.metadata?.pre_registration_issued_at!==m.pre_registration_issued_at)
  return reject("CHECKOUT_AND_SUBSCRIPTION_METADATA_CONFLICT");
 const issued=Number(m.pre_registration_issued_at);
 if(!Number.isSafeInteger(s.created)||issued<s.created-86400||
    issued>s.created+300)
  return reject("SIGNED_REGISTRATION_TIME_INVALID");
 if(s.currency!=="brl"||s.amountTotal!==spec.cents||
    sub.prices?.length!==1||sub.prices[0].id!==spec.priceId||
    sub.prices[0].currency!=="brl"||sub.prices[0].amount!==spec.cents||
    sub.prices[0].interval!=="month")
  return reject("OFFICIAL_MONTHLY_PRICE_MISMATCH");
 if(!i||!i.id.startsWith("in_")||!i.livemode||i.status!=="paid"||
    i.id!==sub.invoiceId||i.customer!==s.customer||
    i.subscriptionId!==sub.id||i.currency!=="brl"||
    i.amountPaid!==spec.cents)
  return reject("FIRST_PAID_INVOICE_NOT_CONFIRMED");
 if(!Number.isSafeInteger(sub.periodStart)||!Number.isSafeInteger(sub.periodEnd)||
    sub.periodStart<=0||sub.periodEnd<=sub.periodStart)
  return reject("SUBSCRIPTION_BILLING_PERIOD_INVALID");
 return {ok:true,sessionId:s.id,subscriptionId:sub.id,customerId:s.customer,
  invoiceId:i.id,registrationId:m.pre_registration_id,plan:plan as GuestCommercialPlan,
  planKey:spec.planKey,priceId:spec.priceId,credits:spec.credits,
  sessionCreated:s.created,issuedAt:issued,hmac:m.pre_registration_proof,
  periodStart:sub.periodStart,periodEnd:sub.periodEnd};
}
