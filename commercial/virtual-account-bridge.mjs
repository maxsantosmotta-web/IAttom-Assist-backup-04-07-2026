/* PONTE VIRTUAL (SEM rede, Stripe, Clerk, SQL, cobranças ou gravações oficiais).
   Nunca usar estas evidências sintéticas como autenticação em produção. */
import {OFFICIAL_MONTHLY_PLANS} from './official-checkout-contract.mjs';
const norm=x=>typeof x==='string'?x.trim().toLowerCase():'';
const ref=x=>typeof x==='string'?x:x?.id;
const id=(x,p)=>typeof x==='string'&&x.startsWith(p)&&x.length>p.length;
const reject=(code,extra={})=>({mode:'VIRTUAL',eligible:false,code,paymentUnchanged:true,
 accountActivated:false,creditsGranted:0,productionWrites:0,...extra});
export function reviewGuestPurchase({
 plan,registration,clerk,checkout,customer,subscription,price,invoice,billingUser,
 stripeServerConfirmed=false,clerkServerVerified=false,
 stripeCustomerOwner=null,stripeSubscriptionOwner=null,
 activeStripeSubscriptions=[],otherBillingEntitlements=[]
}={}){
 const expected=typeof plan==='string'?OFFICIAL_MONTHLY_PLANS[plan]:null;
 if(!expected)return reject('UNKNOWN_PLAN');
 if(!registration?.id||!norm(registration.email)||registration.source!=='server')
  return reject('REGISTRATION_NOT_SERVER_STORED');
 if(!clerkServerVerified||!clerk?.authenticated||!clerk?.emailVerified||
    !id(clerk.userId,'user_')||!norm(clerk.email))return reject('CLERK_VERIFICATION_REQUIRED');
 if(norm(clerk.email)!==norm(registration.email))
  return reject('PENDING_EMAIL_REVIEW',{correctionRequired:true});
 if(!stripeServerConfirmed)return reject('TRUSTED_STRIPE_CONFIRMATION_REQUIRED');
 if(!id(checkout?.id,'cs_live_')||checkout.livemode!==true||
    checkout.status!=='complete'||checkout.payment_status!=='paid'||
    checkout.mode!=='subscription'||checkout.client_reference_id!==registration.id||
    checkout.metadata?.pre_registration_id!==registration.id||
    checkout.metadata?.plan!==plan||checkout.currency!=='brl'||
    checkout.amount_total!==expected.amountCents||
    !id(ref(checkout.customer),'cus_')||!id(ref(checkout.subscription),'sub_'))
  return reject('CHECKOUT_MISMATCH');
 const cid=ref(checkout.customer),sid=ref(checkout.subscription);
 if(customer?.id!==cid||customer.livemode!==true)return reject('CUSTOMER_MISMATCH');
 if(subscription?.id!==sid||subscription.livemode!==true||
    subscription.status!=='active'||ref(subscription.customer)!==cid||
    subscription.metadata?.pre_registration_id!==registration.id||
    subscription.metadata?.planKey!==expected.planKey||
    !Array.isArray(subscription.items?.data)||subscription.items.data.length!==1)
  return reject('SUBSCRIPTION_MISMATCH');
 if(subscription.items.data[0]?.price?.id!==expected.priceId||
    price?.id!==expected.priceId||price.livemode!==true||price.active!==true||
    price.currency!=='brl'||price.unit_amount!==expected.amountCents||
    price.type!=='recurring'||price.recurring?.interval!=='month'||
    price.recurring?.interval_count!==1)
  return reject('PRICE_NOT_EXACT');
 const iid=ref(subscription.latest_invoice);
 if(!id(iid,'in_')||invoice?.id!==iid||invoice.livemode!==true||
    invoice.status!=='paid'||invoice.paid!==true||
    ref(invoice.customer)!==cid||ref(invoice.subscription)!==sid||
    invoice.currency!=='brl'||invoice.amount_paid!==expected.amountCents)
  return reject('INVOICE_NOT_PAID');
 if(!Array.isArray(activeStripeSubscriptions)||activeStripeSubscriptions.length!==1||
    activeStripeSubscriptions[0].id!==sid||
    activeStripeSubscriptions[0].customerId!==cid||
    activeStripeSubscriptions[0].status!=='active')
  return reject('DUPLICATE_STRIPE_SUBSCRIPTIONS_REVIEW');
 if(billingUser?.clerkId!==clerk.userId||norm(billingUser.email)!==norm(clerk.email))
  return reject('BILLING_IDENTITY_MISMATCH');
 if(billingUser.stripeCustomerId&&billingUser.stripeCustomerId!==cid)
  return reject('EXISTING_OTHER_CUSTOMER');
 if(billingUser.stripeSubscriptionId&&billingUser.stripeSubscriptionId!==sid)
  return reject('EXISTING_OTHER_SUBSCRIPTION');
 if(stripeCustomerOwner&&stripeCustomerOwner!==clerk.userId)
  return reject('CUSTOMER_OWNED_BY_ANOTHER_USER');
 if(stripeSubscriptionOwner&&stripeSubscriptionOwner!==clerk.userId)
  return reject('SUBSCRIPTION_OWNED_BY_ANOTHER_USER');
 if(!Array.isArray(otherBillingEntitlements)||otherBillingEntitlements.some(
  e=>e.active===true||e.status==='active'||e.status==='trialing'))
  return reject('GOOGLE_PLAY_OR_OTHER_ENTITLEMENT_REVIEW');
 return {mode:'VIRTUAL',eligible:true,code:'READY_FOR_VIRTUAL_LINK',
  registrationId:registration.id,sessionId:checkout.id,customerId:cid,subscriptionId:sid,
  invoiceId:iid,periodKey:invoice.billingPeriodKey||iid,clerkUserId:clerk.userId,
  plan,priceId:expected.priceId,internalPlan:expected.planKey,
  paymentUnchanged:true,accountActivated:false,creditsGranted:0,productionWrites:0};
}
export function createVirtualLedger({fictionalCredits={}}={}){
 const bySession=new Map(),bySub=new Map(),byCustomer=new Map(),byUser=new Map(),byReg=new Map();
 let queue=Promise.resolve();
 function serialize(fn){
  const p=queue.then(fn);queue=p.catch(()=>{});return p;
 }
 return Object.freeze({
  async claim(decision){
   return serialize(()=>{
    if(!decision||decision.code!=='READY_FOR_VIRTUAL_LINK'||decision.eligible!==true||
       decision.mode!=='VIRTUAL')return reject('VIRTUAL_EVIDENCE_INVALID');
    const {sessionId,subscriptionId,clerkUserId,customerId,registrationId,internalPlan,
     periodKey,plan,priceId}=decision;
    if(!id(sessionId,'cs_live_')||!id(subscriptionId,'sub_')||
       !id(customerId,'cus_')||!id(clerkUserId,'user_')||!registrationId)
      return reject('VIRTUAL_IDS_INVALID');
    const prev=bySession.get(sessionId);
    if(prev){
     if(prev.clerkUserId!==clerkUserId||prev.subscriptionId!==subscriptionId||
        prev.priceId!==priceId||prev.plan!==plan)
      return reject('CLAIM_OWNER_CONFLICT');
     return reject('ALREADY_VIRTUALLY_LINKED',{virtualCreditsAdded:0,virtualPlan:prev.plan});
    }
    if(bySub.has(subscriptionId)||byCustomer.has(customerId)||
       byReg.has(registrationId)||byUser.has(clerkUserId))
      return reject('ANOTHER_PURCHASE_OR_OWNER_REVIEW');
    const credits=fictionalCredits[internalPlan];
    if(!Number.isSafeInteger(credits)||credits<0)
      return reject('FICTIONAL_CREDIT_POLICY_MISSING');
    const item=Object.freeze({sessionId,subscriptionId,clerkUserId,customerId,
     registrationId,internalPlan,plan,priceId,periodKey,fictionalCredits:credits});
    bySession.set(sessionId,item);bySub.set(subscriptionId,sessionId);
    byCustomer.set(customerId,sessionId);byReg.set(registrationId,sessionId);
    byUser.set(clerkUserId,item);
    return reject('VIRTUAL_PLAN_RECOGNIZED',{
     virtualPlan:plan,virtualInternalPlan:internalPlan,virtualCreditsAdded:credits,
     virtualOnly:true
    });
   });
  },
  view(clerkUserId){
   const x=byUser.get(clerkUserId);
   return {mode:'VIRTUAL',virtualPlan:x?.plan||null,
    virtualCredits:x?.fictionalCredits||0,accountActivated:false,
    creditsGranted:0,productionWrites:0};
  },
  counts(){return {sessions:bySession.size,subscriptions:bySub.size,users:byUser.size};}
 });
}
