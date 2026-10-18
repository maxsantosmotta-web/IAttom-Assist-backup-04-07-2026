/** Strict pure assessment; Stripe and Clerk records must come from trusted server APIs. */
import { GUEST_MONTHLY, validateGuestRegistrationProof, type GuestCommercialPlan } from "./guestCommercialProof.js";

export type GuestAssessment =
 | {ok:true;code:"GUEST_PURCHASE_VERIFIED";sessionId:string;customerId:string;
    subscriptionId:string;invoiceId:string;plan:GuestCommercialPlan;
    planKey:"pro"|"business"|"agency";credits:number;priceId:string;
    registrationId:string;clerkId:string}
 | {ok:false;code:string};

type Meta=Record<string,string|undefined>;
export function assessGuestCommercialPurchase(input:{
 session:{id:string;livemode:boolean;status:string|null;paymentStatus:string;mode:string;
   customer:string;subscriptionId:string;created:number;currency:string|null;
   amountTotal:number|null;clientReferenceId:string|null;metadata:Meta};
 subscription:{id:string;livemode:boolean;status:string;customer:string;metadata:Meta;
   itemPrices:Array<{id:string;currency:string;amount:number|null;interval:string|null}>;
   invoiceId:string};
 invoice:{id:string;livemode:boolean;status:string|null;paid:boolean;customer:string;
   subscriptionId:string;currency:string;amountPaid:number};
 user:{clerkId:string;email:string;plan:string;role:string;
   stripeCustomerId:string|null;stripeSubscriptionId:string|null}|null;
 clerkId:string;verifiedClerkEmail:string;sharedSigningKey:string;nowSeconds:number;
 existingCustomerOwner:string|null;existingSubscriptionOwner:string|null;
 activeSubscriptionsForCustomer:string[];
}):GuestAssessment {
 const reject=(code:string):GuestAssessment=>({ok:false,code});
 const {session:s,subscription:sub,invoice,user}=input;
 if (!s?.id?.startsWith("cs_live_") || !s.livemode || s.status!=="complete" ||
     s.mode!=="subscription" || s.paymentStatus!=="paid" ||
     !s.customer?.startsWith("cus_") || !s.subscriptionId?.startsWith("sub_") ||
     s.customer!==sub?.customer || s.subscriptionId!==sub?.id || !sub.livemode ||
     sub.status!=="active")return reject("STRIPE_PAID_ACTIVE_SUBSCRIPTION_REQUIRED");
 const proof=validateGuestRegistrationProof({metadata:s.metadata,
   clerkPrimaryEmail:input.verifiedClerkEmail,checkoutCreated:s.created,
   sharedSigningKey:input.sharedSigningKey,nowSeconds:input.nowSeconds});
 if(!proof.ok)return proof;
 if (s.clientReferenceId!==proof.registrationId ||
     sub.metadata?.commercial_source!=="landing" ||
     sub.metadata?.pre_registration_id!==proof.registrationId ||
     sub.metadata?.plan!==proof.plan || sub.metadata?.planKey!==proof.planKey ||
     (sub.metadata?.clerkUserId&&sub.metadata.clerkUserId!==input.clerkId))
  return reject("SESSION_OR_SUBSCRIPTION_PROOF_MISMATCH");
 const spec=GUEST_MONTHLY[proof.plan];
 if(s.currency!=="brl" || s.amountTotal!==spec.cents ||
    sub.itemPrices?.length!==1 || sub.itemPrices[0].id!==spec.priceId ||
    sub.itemPrices[0].currency!=="brl" || sub.itemPrices[0].amount!==spec.cents ||
    sub.itemPrices[0].interval!=="month")
  return reject("EXACT_MONTHLY_PRICE_REQUIRED");
 if(!invoice?.id?.startsWith("in_") || invoice.id!==sub.invoiceId ||
    !invoice.livemode || !invoice.paid || invoice.status!=="paid" ||
    invoice.customer!==s.customer || invoice.subscriptionId!==sub.id ||
    invoice.currency!=="brl" || invoice.amountPaid!==spec.cents)
  return reject("PAID_INVOICE_NOT_CONFIRMED");
 if(!user || user.clerkId!==input.clerkId ||
    user.email.trim().toLowerCase()!==input.verifiedClerkEmail.trim().toLowerCase())
  return reject("USER_NOT_SAFELY_RESOLVED");
 if(user.role==="admin" || (user.plan!=="free"&&user.stripeSubscriptionId!==sub.id))
  return reject("EXISTING_PLAN_REQUIRES_REVIEW");
 if((user.stripeCustomerId&&user.stripeCustomerId!==s.customer) ||
    (user.stripeSubscriptionId&&user.stripeSubscriptionId!==sub.id) ||
    (input.existingCustomerOwner&&input.existingCustomerOwner!==input.clerkId) ||
    (input.existingSubscriptionOwner&&input.existingSubscriptionOwner!==input.clerkId))
  return reject("OWNERSHIP_CONFLICT");
 if(input.activeSubscriptionsForCustomer.length!==1 ||
    input.activeSubscriptionsForCustomer[0]!==sub.id)
  return reject("MULTIPLE_SUBSCRIPTIONS_REVIEW");
 return {ok:true,code:"GUEST_PURCHASE_VERIFIED",sessionId:s.id,customerId:s.customer,
   subscriptionId:sub.id,invoiceId:invoice.id,plan:proof.plan,planKey:proof.planKey,
   credits:proof.credits,priceId:proof.priceId,registrationId:proof.registrationId,clerkId:input.clerkId};
}
