/**
 * ISOLATED BRANCH. Paid-checkout claim journal (no Stripe calls and NO credits
 * writes). Accept only trusted server-verified inputs, never browser JSON.
 * Requires reviewed PostgreSQL migration before any live use.
 */
import {randomUUID} from "node:crypto";
import {sql} from "drizzle-orm";
import {validateGuestRegistrationProof} from "./guestCommercialProof.js";
import type {VerifiedPaidGuest} from "./guestPaidUnlinkedPolicy.js";

export type JournalDatabase = {
 execute(query:unknown):Promise<{rows:Record<string,unknown>[]}>;
 transaction<T>(run:(tx:JournalDatabase)=>Promise<T>):Promise<T>;
};
type PaidProof=VerifiedPaidGuest;
const no=(code:string)=>({ok:false as const,code});
const yes=(code:string,extra:Record<string,unknown>={})=>({ok:true as const,code,...extra});
const id=(x:string,p:string)=>typeof x==="string"&&x.startsWith(p)&&x.length>p.length;
const email=(x:string)=>typeof x==="string"?x.trim().toLowerCase():"";

export async function stageServerVerifiedPaidPurchase(db:JournalDatabase,p:PaidProof){
 if(!p||p.ok!==true||!id(p.sessionId,"cs_live_")||
    !id(p.subscriptionId,"sub_")||!id(p.customerId,"cus_")||
    !id(p.invoiceId,"in_")||!/^price_[A-Za-z0-9]+$/.test(p.priceId)||
    !["pro","business","agency"].includes(p.planKey)||
    !Number.isSafeInteger(p.credits)||p.credits<1||
    !Number.isSafeInteger(p.sessionCreated)||!Number.isSafeInteger(p.issuedAt)||
    !/^[a-f0-9]{64}$/.test(p.hmac)||
    !Number.isSafeInteger(p.periodStart)||!Number.isSafeInteger(p.periodEnd)||
    p.periodEnd<=p.periodStart)return no("PAID_STRIPE_ASSESSMENT_REQUIRED");
 return db.transaction(async tx=>{
  const created=await tx.execute(sql`
   INSERT INTO commercial_guest_claims(checkout_session_id,stripe_subscription_id,
    stripe_customer_id,stripe_invoice_id,registration_id,price_id,plan_key,
    commercial_plan,checkout_created_at,pre_registration_issued_at,pre_registration_proof,
    general_credit_amount,billing_period_start,billing_period_end)
   VALUES(${p.sessionId},${p.subscriptionId},${p.customerId},${p.invoiceId},
    ${p.registrationId},${p.priceId},${p.planKey},
    ${p.plan},${p.sessionCreated},${p.issuedAt},${p.hmac},${p.credits},
    ${p.periodStart},${p.periodEnd})
   ON CONFLICT DO NOTHING RETURNING checkout_session_id
  `);
  if(created.rows.length)return yes("PAID_PURCHASE_SAVED_UNLINKED");
  const r=await tx.execute(sql`
   SELECT * FROM commercial_guest_claims
   WHERE checkout_session_id=${p.sessionId} OR stripe_subscription_id=${p.subscriptionId}
   FOR UPDATE
  `);
  const row=r.rows[0];
  if(r.rows.length!==1||row.checkout_session_id!==p.sessionId||
    row.stripe_subscription_id!==p.subscriptionId||
    row.stripe_customer_id!==p.customerId||
    row.registration_id!==p.registrationId||row.price_id!==p.priceId||
    row.plan_key!==p.planKey||row.commercial_plan!==p.plan||
    Number(row.checkout_created_at)!==p.sessionCreated||
    Number(row.pre_registration_issued_at)!==p.issuedAt||
    row.pre_registration_proof!==p.hmac||
    row.stripe_invoice_id!==p.invoiceId||
    Number(row.general_credit_amount)!==p.credits||
    Number(row.billing_period_start)!==p.periodStart||
    Number(row.billing_period_end)!==p.periodEnd)
   return no("PAID_PURCHASE_FINGERPRINT_CONFLICT");
  return yes("PAID_PURCHASE_ALREADY_SAVED",{state:row.status});
 });
}
export async function linkVerifiedOwner(db:JournalDatabase,a:{
 sessionId:string;clerkId:string;verifiedClerkEmail:string;
 sharedSigningKey:string;nowSeconds:number;
}){
 if(!email(a.verifiedClerkEmail))return no("VERIFIED_CLERK_EMAIL_REQUIRED");
 if(!id(a.sessionId,"cs_live_")||!id(a.clerkId,"user_"))
  return no("AUTHENTICATED_IDS_REQUIRED");
 return db.transaction(async tx=>{
  const r=await tx.execute(sql`
   SELECT * FROM commercial_guest_claims WHERE checkout_session_id=${a.sessionId} FOR UPDATE
  `);
  const p=r.rows[0];if(!p)return no("PAID_PURCHASE_NOT_SAVED");
  // The registration identity is proved from IMMUTABLE STRIPE-paid journal
  // values, not an email parameter submitted by the browser.
  const proof=validateGuestRegistrationProof({
   metadata:{
    commercial_source:"landing",
    plan:String(p.commercial_plan),
    planKey:String(p.plan_key),
    pre_registration_id:String(p.registration_id),
    pre_registration_issued_at:String(p.pre_registration_issued_at),
    pre_registration_proof:String(p.pre_registration_proof)
   },
   clerkPrimaryEmail:a.verifiedClerkEmail,
   checkoutCreated:Number(p.checkout_created_at),
   sharedSigningKey:a.sharedSigningKey,
   nowSeconds:a.nowSeconds
  });
  if(!proof.ok||proof.priceId!==p.price_id)
   return no("CLERK_DOES_NOT_MATCH_SIGNED_REGISTRATION");
  if(p.clerk_user_id&&p.clerk_user_id!==a.clerkId)return no("PURCHASE_OWNED_BY_OTHER");
  if(p.status==="REVIEW")return no("PURCHASE_AWAITING_REVIEW");
  const u=(await tx.execute(sql`
   SELECT * FROM users WHERE clerk_id=${a.clerkId} FOR UPDATE
  `)).rows[0];
  if(!u||email(String(u.email))!==email(a.verifiedClerkEmail)||u.role==="admin")
   return no("VERIFIED_CLERK_USER_NOT_ELIGIBLE");
  if((u.stripe_customer_id&&u.stripe_customer_id!==p.stripe_customer_id)||
     (u.stripe_subscription_id&&u.stripe_subscription_id!==p.stripe_subscription_id)||
     (u.plan!=="free"&&u.stripe_subscription_id!==p.stripe_subscription_id)){
   await tx.execute(sql`UPDATE commercial_guest_claims
    SET status='REVIEW',last_error='EXISTING_SUBSCRIPTION_CONFLICT'
    WHERE checkout_session_id=${a.sessionId} AND status='PAID_UNLINKED'`);
   return no("PAID_PURCHASE_PRESERVED_FOR_REVIEW");
  }
  if(p.clerk_user_id===a.clerkId)return yes("ALREADY_LINKED",{state:p.status});
  const linked=await tx.execute(sql`
   UPDATE commercial_guest_claims SET clerk_user_id=${a.clerkId},status='READY'
   WHERE checkout_session_id=${a.sessionId}
     AND clerk_user_id IS NULL AND status='PAID_UNLINKED'
   RETURNING checkout_session_id
  `);
  return linked.rows.length?yes("READY_FOR_CANONICAL"):no("CONCURRENT_LINK_RETRY");
 });
}
export async function leaseForCanonical(db:JournalDatabase,a:{
 sessionId:string;clerkId:string;now:Date;leaseMs?:number;
}){
 const ms=a.leaseMs??60000;
 if(!id(a.sessionId,"cs_live_")||!id(a.clerkId,"user_")||
   !(a.now instanceof Date)||!Number.isFinite(a.now.getTime())||
   !Number.isSafeInteger(ms)||ms<1000||ms>600000)return no("INVALID_LEASE");
 return db.transaction(async tx=>{
  const p=(await tx.execute(sql`
   SELECT * FROM commercial_guest_claims WHERE checkout_session_id=${a.sessionId} FOR UPDATE
  `)).rows[0];
  if(!p||p.clerk_user_id!==a.clerkId)return no("NOT_LINKED_TO_CLERK");
  if(p.status==="COMPLETED")return yes("ALREADY_COMPLETED");
  if(p.status==="PROCESSING"&&new Date(String(p.lease_expires_at)).getTime()>a.now.getTime())
   return no("CANONICAL_IN_PROGRESS");
  if(!["READY","RETRYABLE","PROCESSING"].includes(String(p.status)))
   return no("PURCHASE_NOT_READY");
  const token=randomUUID(),until=new Date(a.now.getTime()+ms);
  await tx.execute(sql`
   UPDATE commercial_guest_claims
   SET status='PROCESSING',lease_token=${token},lease_expires_at=${until}
   WHERE checkout_session_id=${a.sessionId}
  `);
  return yes("LEASED_FOR_CANONICAL",{leaseToken:token,expiresAt:until.toISOString(),
   sessionId:a.sessionId,subscriptionId:p.stripe_subscription_id,
   priceId:p.price_id,planKey:p.plan_key,
   expectedCredits:Number(p.general_credit_amount)});
 });
}
export async function finishOnlyIfCanonicalRecorded(db:JournalDatabase,a:{
 sessionId:string;clerkId:string;leaseToken:string;now:Date;
}){
 if(!id(a.sessionId,"cs_live_")||!id(a.clerkId,"user_")||
   typeof a.leaseToken!=="string"||!(a.now instanceof Date))
  return no("INVALID_FINALIZATION");
 return db.transaction(async tx=>{
  const p=(await tx.execute(sql`
   SELECT * FROM commercial_guest_claims WHERE checkout_session_id=${a.sessionId} FOR UPDATE
  `)).rows[0];
  if(!p||p.clerk_user_id!==a.clerkId)return no("NOT_LINKED_TO_CLERK");
  if(p.status==="COMPLETED")return yes("ALREADY_COMPLETED");
  if(p.status!=="PROCESSING"||p.lease_token!==a.leaseToken||
     new Date(String(p.lease_expires_at)).getTime()<=a.now.getTime())
   return no("INVALID_OR_STALE_LEASE");
  const key=["subscription",p.stripe_subscription_id,p.price_id,
    String(p.billing_period_start),String(p.billing_period_end),
    p.plan_key,"general"].join(":");
  const u=(await tx.execute(sql`
   SELECT * FROM users WHERE clerk_id=${a.clerkId} FOR UPDATE
  `)).rows[0];
  const ledger=(await tx.execute(sql`
   SELECT * FROM credits_transactions WHERE stripe_session_id=${key}
  `)).rows;
  const success=!!u&&u.plan===p.plan_key&&
   u.stripe_customer_id===p.stripe_customer_id&&
   u.stripe_subscription_id===p.stripe_subscription_id&&
   u.stripe_subscription_status==="active"&&ledger.length===1&&
   ledger[0].clerk_user_id===a.clerkId&&
   ledger[0].type==="credit"&&ledger[0].balance_type==="general"&&
   Number(ledger[0].amount)===Number(p.general_credit_amount);
  if(!success){
   await tx.execute(sql`UPDATE commercial_guest_claims
    SET status='RETRYABLE',lease_token=NULL,lease_expires_at=NULL,
    last_error='CANONICAL_NOT_CONFIRMED'
    WHERE checkout_session_id=${a.sessionId}`);
   return no("CANONICAL_NOT_CONFIRMED_RETRYABLE");
  }
  await tx.execute(sql`UPDATE commercial_guest_claims
   SET status='COMPLETED',lease_token=NULL,lease_expires_at=NULL,last_error=NULL
   WHERE checkout_session_id=${a.sessionId} AND lease_token=${a.leaseToken}`);
  return yes("CANONICAL_CREDITS_AND_PLAN_CONFIRMED");
 });
}
export async function releaseForRetry(db:JournalDatabase,a:{sessionId:string;leaseToken:string}){
 if(!id(a.sessionId,"cs_live_")||typeof a.leaseToken!=="string")
  return no("INVALID_RELEASE");
 const r=await db.execute(sql`UPDATE commercial_guest_claims
  SET status='RETRYABLE',lease_token=NULL,lease_expires_at=NULL,
   last_error='RETRY_REQUIRED'
  WHERE checkout_session_id=${a.sessionId} AND lease_token=${a.leaseToken}
    AND status='PROCESSING' RETURNING checkout_session_id`);
 return r.rows.length?yes("RETRYABLE"):no("RETRY_TOKEN_STALE");
}
