/**
 * Guest Stripe purchase capture after a server-verified Stripe webhook, or as
 * a read-only Stripe catch-up from an authenticated claim.
 * Writes ONLY to the isolated commercial_guest_claims journal.
 * No credits, user, price or Stripe mutation.
 */
import type Stripe from "stripe";
import {db} from "@workspace/db";
import {getUncachableStripeClient} from "./stripeClient.js";
import {assessStripePaidGuestWithoutClerk} from "./guestPaidUnlinkedPolicy.js";
import {stageServerVerifiedPaidPurchase} from "./guestCommercialJournal.js";

type InvoiceRef=Stripe.Invoice & {
 subscription?:string|Stripe.Subscription|null;
 parent?:{subscription_details?:{subscription?:string|Stripe.Subscription|null}|null}|null;
};
type Period=Stripe.SubscriptionItem&{current_period_start?:number;current_period_end?:number};
const id=(x:string|{id:string}|null|undefined):string=>
 typeof x==="string"?x:x?.id??"";
export async function captureServerVerifiedGuestPurchase(sessionId:string){
 if(!/^cs_live_[A-Za-z0-9_]{6,255}$/.test(sessionId))
  return {ok:false as const,code:"INVALID_CHECKOUT_SESSION"};
 const stripe=await getUncachableStripeClient();
 const session=await stripe.checkout.sessions.retrieve(sessionId);
 // Never insert a receipt on a preliminary/failed/unpaid checkout.
 if(session.status!=="complete"||session.payment_status!=="paid"||
    session.mode!=="subscription"||!session.livemode||!session.subscription||
    !session.customer)
  return {ok:false as const,code:"STRIPE_PAID_SUBSCRIPTION_REQUIRED"};
 const subscription=await stripe.subscriptions.retrieve(id(session.subscription));
 const invoiceId=id(session.invoice)||id(subscription.latest_invoice);
 if(!invoiceId.startsWith("in_"))return {ok:false as const,code:"INVOICE_REQUIRED"};
 const invoice=await stripe.invoices.retrieve(invoiceId);
 const it=subscription.items.data[0] as Period|undefined;
 if(!it)return {ok:false as const,code:"SUBSCRIPTION_ITEM_REQUIRED"};
 const typed=invoice as InvoiceRef;
 const invoiceSub=id(typed.subscription??typed.parent?.subscription_details?.subscription);
 if(invoiceSub!==subscription.id)return {ok:false as const,code:"INVOICE_OWNERSHIP_UNVERIFIED"};
 const proof=assessStripePaidGuestWithoutClerk({
  session:{
   id:session.id,livemode:session.livemode,status:session.status,
   paymentStatus:session.payment_status,mode:session.mode,
   customer:id(session.customer),subscriptionId:id(session.subscription),
   created:session.created,currency:session.currency,
   amountTotal:session.amount_total,clientReferenceId:session.client_reference_id,
   metadata:session.metadata??{}
  },
  subscription:{
   id:subscription.id,livemode:subscription.livemode,status:subscription.status,
   customer:id(subscription.customer),metadata:subscription.metadata??{},
   prices:subscription.items.data.map(item=>({
    id:item.price.id,currency:item.price.currency,amount:item.price.unit_amount,
    interval:item.price.recurring?.interval??null
   })),
   invoiceId,periodStart:it.current_period_start??0,
   periodEnd:it.current_period_end??0
  },
  invoice:{
   id:invoice.id,livemode:invoice.livemode,status:invoice.status,
   customer:id(invoice.customer),subscriptionId:invoiceSub,
   currency:invoice.currency,amountPaid:invoice.amount_paid
  }
 });
 if(!proof.ok)return proof;
 const staged=await stageServerVerifiedPaidPurchase(db,proof);
 if(!staged.ok)return staged;
 return {ok:true as const,code:staged.code,sessionId:proof.sessionId,
  subscriptionId:proof.subscriptionId,customerId:proof.customerId,
  priceId:proof.priceId,planKey:proof.planKey};
}
