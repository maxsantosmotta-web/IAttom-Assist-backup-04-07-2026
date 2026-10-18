/** Guest Checkout claim in a COPY of the official backend.
 * Financial writes are HARD-CLOSED by source, independent of environment flags.
 * DO NOT enable without separately approving isolated PostgreSQL validation.
 */
import type Stripe from "stripe";
import { clerkClient } from "@clerk/express";
import { eq, sql } from "drizzle-orm";
import { db, users } from "@workspace/db";
import { getUncachableStripeClient } from "./stripeClient.js";
import { handleCanonicalSubscriptionChange } from "./stripeCanonicalSubscription.js";
import { assessGuestCommercialPurchase } from "./guestCommercialPolicy.js";
import { normalizeVerifiedEmail } from "./guestCommercialProof.js";

export const COMMERCIAL_GUEST_WRITE_RELEASED: boolean = false;
const denied=(code:string)=>({ok:false as const,code,accountActivated:false,creditsGranted:0});
const objectId=(x:string|{id:string}|null|undefined):string=>
  typeof x==="string"?x:x?.id??"";
type InvoiceWithSubscription=Stripe.Invoice&{
  subscription?:string|Stripe.Subscription|null;
  parent?:{subscription_details?:{subscription?:string|Stripe.Subscription|null}|null}|null;
};
async function verifiedClerkEmail(userId:string):Promise<string|null>{
 const user=await clerkClient.users.getUser(userId);
 if(user.banned||user.locked)return null;
 const primary=user.emailAddresses.find(e=>e.id===user.primaryEmailAddressId);
 return primary?.verification?.status==="verified"
  ?normalizeVerifiedEmail(primary.emailAddress):null;
}
export async function claimCommercialGuestCheckout(input:{
 authenticatedClerkId:string;checkoutSessionId:string;
}){
 // This guard MUST remain before all external requests or data writes.
 if(!COMMERCIAL_GUEST_WRITE_RELEASED)return denied("GUEST_CLAIM_NOT_RELEASED");
 if(process.env.COMMERCIAL_GUEST_CLAIM_ENABLED!=="true"||
    !process.env.COMMERCIAL_REGISTRATION_HMAC_KEY)
  return denied("GUEST_CLAIM_NOT_CONFIGURED");
 const {authenticatedClerkId,checkoutSessionId}=input;
 if(!/^user_[A-Za-z0-9]{5,128}$/.test(authenticatedClerkId)||
    !/^cs_live_[A-Za-z0-9_]{6,255}$/.test(checkoutSessionId))
  return denied("INVALID_AUTHENTICATION_OR_SESSION");
 const verified=await verifiedClerkEmail(authenticatedClerkId);
 if(!verified)return denied("CLERK_PRIMARY_EMAIL_NOT_VERIFIED");
 const stripe=await getUncachableStripeClient();
 const session=await stripe.checkout.sessions.retrieve(checkoutSessionId);
 if(!session.livemode||session.mode!=="subscription"||session.status!=="complete"||
    session.payment_status!=="paid"||!session.subscription||!session.customer)
  return denied("STRIPE_PAID_SESSION_REQUIRED");
 const subscriptionId=objectId(session.subscription),customerId=objectId(session.customer);
 const [subscription,usersById,customerOwners,subscriptionOwners]=await Promise.all([
  stripe.subscriptions.retrieve(subscriptionId),
  db.select().from(users).where(eq(users.clerkId,authenticatedClerkId)).limit(1),
  db.select().from(users).where(eq(users.stripeCustomerId,customerId)).limit(1),
  db.select().from(users).where(eq(users.stripeSubscriptionId,subscriptionId)).limit(1)
 ]);
 const invoiceId=objectId(subscription.latest_invoice);
 if(!invoiceId.startsWith("in_"))return denied("PAID_INVOICE_REQUIRED");
 const [invoice,active]=await Promise.all([
  stripe.invoices.retrieve(invoiceId),
  stripe.subscriptions.list({customer:customerId,status:"active",limit:100})
 ]);
 if(active.has_more)return denied("SUBSCRIPTIONS_LIST_INCOMPLETE");
 const typed=invoice as InvoiceWithSubscription;
 const invoiceSubscriptionId=objectId(typed.subscription??typed.parent?.subscription_details?.subscription);
 if(!invoiceSubscriptionId)return denied("INVOICE_SUBSCRIPTION_NOT_FOUND");
 const proof=assessGuestCommercialPurchase({
  session:{id:session.id,livemode:session.livemode,status:session.status,
   paymentStatus:session.payment_status,mode:session.mode,customer:customerId,
   subscriptionId,created:session.created,currency:session.currency,
   amountTotal:session.amount_total,clientReferenceId:session.client_reference_id,
   metadata:session.metadata??{}},
  subscription:{id:subscription.id,livemode:subscription.livemode,
   status:subscription.status,customer:objectId(subscription.customer),
   metadata:subscription.metadata??{},
   itemPrices:subscription.items.data.map(i=>({id:i.price.id,currency:i.price.currency,
    amount:i.price.unit_amount,interval:i.price.recurring?.interval??null})),
   invoiceId},
  invoice:{id:invoice.id,livemode:invoice.livemode,paid:invoice.paid,
   status:invoice.status,customer:objectId(invoice.customer),
   subscriptionId:invoiceSubscriptionId,currency:invoice.currency,
   amountPaid:invoice.amount_paid},
  user:usersById[0]?{clerkId:usersById[0].clerkId,email:usersById[0].email,
   plan:usersById[0].plan,role:usersById[0].role,
   stripeCustomerId:usersById[0].stripeCustomerId,
   stripeSubscriptionId:usersById[0].stripeSubscriptionId}:null,
  clerkId:authenticatedClerkId,verifiedClerkEmail:verified,
  sharedSigningKey:process.env.COMMERCIAL_REGISTRATION_HMAC_KEY,
  nowSeconds:Math.floor(Date.now()/1000),
  existingCustomerOwner:customerOwners[0]?.clerkId??null,
  existingSubscriptionOwner:subscriptionOwners[0]?.clerkId??null,
  activeSubscriptionsForCustomer:active.data.map(a=>a.id)
 });
 if(!proof.ok)return proof;
 // Advisory locks + row lock prevent conflicting ownership transfers.
 // This does not replace an idempotent credit ledger in PostgreSQL.
 const ownership=await db.transaction(async(tx)=>{
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('iattom-guest-customer'),hashtext(${customerId}))`);
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('iattom-guest-subscription'),hashtext(${subscriptionId}))`);
  const locked=await tx.execute(sql`SELECT clerk_id,email,role,plan,stripe_customer_id,stripe_subscription_id
   FROM users WHERE clerk_id=${authenticatedClerkId} FOR UPDATE`);
  const row=locked.rows[0] as Record<string,unknown>|undefined;
  if(!row||String(row.email).trim().toLowerCase()!==verified||row.role==="admin"||
     (row.plan!=="free"&&row.stripe_subscription_id!==subscriptionId)||
     (row.stripe_customer_id&&row.stripe_customer_id!==customerId)||
     (row.stripe_subscription_id&&row.stripe_subscription_id!==subscriptionId))
   return false;
  const conflicting=await tx.execute(sql`SELECT clerk_id FROM users
   WHERE (stripe_customer_id=${customerId} OR stripe_subscription_id=${subscriptionId})
     AND clerk_id<>${authenticatedClerkId} LIMIT 1`);
  if(conflicting.rows.length)return false;
  await tx.update(users).set({stripeCustomerId:customerId,
    stripeSubscriptionId:subscriptionId,updatedAt:new Date()})
    .where(eq(users.clerkId,authenticatedClerkId));
  return true;
 });
 if(!ownership)return denied("OWNERSHIP_CONFLICT_REQUIRES_REVIEW");
 // Existing official credit routine is the ONLY writer. No invented balances.
 const result=await handleCanonicalSubscriptionChange(subscription);
 if(!result.ok||result.clerkUserId!==authenticatedClerkId||
    result.subscriptionId!==subscriptionId||result.priceId!==proof.priceId||
    result.targetPlan!==proof.planKey)
  return denied("FINANCIAL_RECONCILIATION_RETRY_REQUIRED");
 return {ok:true as const,code:"GUEST_SUBSCRIPTION_RECOGNIZED",
  plan:proof.plan,priceId:proof.priceId,subscriptionId,
  creditsGranted:result.generalGranted,alreadyReconciled:result.generalAlreadyGranted,
  accountActivated:true};
}
