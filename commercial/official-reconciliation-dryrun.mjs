import {getCommercialPreviewPlan} from './official-compatibility.mjs';
import {HandoffState} from './pending-handoff.mjs';
/**
 * Especificação executável e exclusivamente de leitura. Os adapters, incluindo
 * autenticação e APIs externas, são FICTÍCIOS nos testes. Sem rotas ou mutações.
 */
const blocked=(code)=>({mode:'DRY_RUN',eligible:false,code,accountActivated:false,creditsGranted:0,requiresOfficialAuthorization:true});
const id=(x,p)=>typeof x==='string'&&x.startsWith(p)&&x.length>p.length;
const email=x=>typeof x==='string'?x.trim().toLowerCase():'';
const ref=x=>typeof x==='string'?x:x?.id;
export async function prepareOfficialReconciliationDryRun({pending,registeredEmail,testPriceIds,adapters}={}){
 if(!pending||pending.pendingStatus!==HandoffState.WAITING||
    pending.paymentStatus!=='PAID_TEST'||pending.accountActivated!==false||
    !id(pending.sessionId,'cs_test_')||!id(pending.customerId,'cus_')||
    !pending.registrationId)return blocked('NO_CONFIRMED_GUEST_HANDOFF');
 const plan=getCommercialPreviewPlan(pending.plan);
 if(!plan||pending.amountBRL!==plan.amountBRL||pending.legacyPlanKey!==plan.legacyPlanKey)
   return blocked('INVALID_COMMERCIAL_PLAN');
 const expectedPrice=testPriceIds?.[pending.plan];
 if(!id(expectedPrice,'price_'))return blocked('EXPECTED_PRICE_NOT_SET');
 const required=['getClerkIdentity','verifyRegistrationClaim','retrieveCheckout','retrieveSubscription',
   'retrieveInvoice','listActiveSubscriptions','getBillingUser','findCustomerOwner','findRecordedClaim'];
 if(!required.every(x=>typeof adapters?.[x]==='function'))return blocked('TRUSTED_ADAPTERS_MISSING');
 // Somente o futuro backend autenticado poderá fornecer provas ao reconciliador.
 const clerk=await adapters.getClerkIdentity();
 if(!clerk||clerk.trustedServerVerification!==true||clerk.authenticated!==true||
    clerk.emailVerified!==true||!id(clerk.clerkUserId,'user_')||!email(registeredEmail)||
    email(clerk.email)!==email(registeredEmail))
   return blocked('CLERK_IDENTITY_NOT_VERIFIED');
 if((await adapters.verifyRegistrationClaim({
   registrationId:pending.registrationId,clerkUserId:clerk.clerkUserId,
   email:email(registeredEmail),sessionId:pending.sessionId
 }))!==true)return blocked('PURCHASE_CLAIM_NOT_PROVEN');
 const checkout=await adapters.retrieveCheckout(pending.sessionId);
 if(!checkout||checkout.id!==pending.sessionId||checkout.livemode!==false||
   checkout.mode!=='subscription'||checkout.status!=='complete'||checkout.payment_status!=='paid'||
   checkout.client_reference_id!==pending.registrationId||
   checkout.metadata?.pre_registration_id!==pending.registrationId||
   checkout.metadata?.plan!==pending.plan||ref(checkout.customer)!==pending.customerId||
   checkout.currency!=='brl'||checkout.amount_total!==plan.amountBRL||
   !id(ref(checkout.subscription),'sub_'))return blocked('STRIPE_CHECKOUT_MISMATCH');
 const sid=ref(checkout.subscription);
 const subscription=await adapters.retrieveSubscription(sid);
 if(!subscription||subscription.id!==sid||subscription.livemode!==false||
   subscription.status!=='active'||ref(subscription.customer)!==pending.customerId||
   subscription.metadata?.pre_registration_id!==pending.registrationId||
   subscription.metadata?.planKey!==plan.legacyPlanKey||
   !Array.isArray(subscription.items?.data)||subscription.items.data.length!==1)
   return blocked('STRIPE_SUBSCRIPTION_MISMATCH');
 const price=subscription.items.data[0]?.price;
 if(!price||price.id!==expectedPrice||price.livemode!==false||
   price.currency!=='brl'||price.unit_amount!==plan.amountBRL||
   price.type!=='recurring'||price.recurring?.interval!=='month'||
   price.recurring.interval_count!==1)return blocked('STRIPE_PRICE_MISMATCH');
 const invoiceID=ref(subscription.latest_invoice);
 if(!id(invoiceID,'in_'))return blocked('LATEST_INVOICE_MISSING');
 const invoice=await adapters.retrieveInvoice(invoiceID);
 if(!invoice||invoice.id!==invoiceID||invoice.livemode!==false||
   invoice.paid!==true||invoice.status!=='paid'||ref(invoice.customer)!==pending.customerId||
   ref(invoice.subscription??invoice.parent?.subscription_details?.subscription)!==sid||
   invoice.currency!=='brl'||invoice.amount_paid!==plan.amountBRL)
   return blocked('INVOICE_NOT_CONFIRMED');
 const active=await adapters.listActiveSubscriptions(pending.customerId);
 if(!Array.isArray(active)||active.filter(x=>['active','trialing'].includes(x.status)).length!==1||
   !active.some(x=>x.id===sid&&x.status==='active'))
   return blocked('DUPLICATE_OR_MISSING_STRIPE_SUBSCRIPTION');
 const user=await adapters.getBillingUser(clerk.clerkUserId);
 if(!user||user.clerkUserId!==clerk.clerkUserId||email(user.email)!==email(registeredEmail))
   return blocked('BILLING_USER_MISMATCH');
 if(user.stripeCustomerId&&user.stripeCustomerId!==pending.customerId)
   return blocked('USER_HAS_OTHER_STRIPE_CUSTOMER');
 if(user.stripeSubscriptionId&&user.stripeSubscriptionId!==sid)
   return blocked('USER_HAS_OTHER_SUBSCRIPTION');
 const owner=await adapters.findCustomerOwner(pending.customerId);
 if(owner&&owner!==clerk.clerkUserId)return blocked('STRIPE_CUSTOMER_OWNED_BY_OTHER_USER');
 const claim=await adapters.findRecordedClaim(pending.sessionId);
 if(claim&&(claim.clerkUserId!==clerk.clerkUserId||claim.subscriptionId!==sid))
   return blocked('PREVIOUS_CLAIM_CONFLICT');
 if(claim?.status==='RECONCILED')return blocked('ALREADY_RECONCILED');
 return {mode:'DRY_RUN',eligible:true,code:'READY_FOR_AUTHORIZED_REVIEW',
   commercialPlan:pending.plan,legacyPlanKey:plan.legacyPlanKey,
   registrationId:pending.registrationId,clerkUserId:clerk.clerkUserId,
   customerId:pending.customerId,subscriptionId:sid,
   checkoutSessionId:pending.sessionId,invoiceId:invoiceID,
   expectedAmountBRL:plan.amountBRL,
   proposedChecks:['unique_claim_transaction','recheck_customer_owner','recheck_active_subscriptions',
      'confirm_paid_invoice','idempotent_billing_period_credits'],
   accountActivated:false,creditsGranted:0,requiresOfficialAuthorization:true};
}
