/**
 * Preflight comercial do IAttom Assist.
 * SEM escritura: todos os provedores são adaptadores EXCLUSIVAMENTE read-only.
 * Não é rota pública; não concede plano, não chama Stripe Checkout, não grava DB.
 *
 * A ordem de validação protege a identidade:
 * 1. sessão Clerk autenticada no backend,
 * 2. identidade verificada buscada no Clerk (nunca e-mail informado pelo browser),
 * 3. checkout obtido diretamente do Stripe pelo id,
 * 4. pré-cadastro do servidor vinculado ao checkout,
 * 5. checagem de e-mail + demais relações Stripe/billing.
 */
import {OFFICIAL_MONTHLY_PLANS} from './official-checkout-contract.mjs';
import {reviewGuestPurchase} from './virtual-account-bridge.mjs';

const code=(value,details={})=>Object.freeze({
 mode:'READ_ONLY_PREFLIGHT',readyForProduction:false,
 eligible:false,code:value,accountActivated:false,creditsGranted:0,productionWrites:0,
 paymentUnchanged:true,...details
});
const ref=x=>typeof x==='string'?x:x?.id;
const sameEmail=(a,b)=>typeof a==='string'&&typeof b==='string'&&
 a.trim().toLowerCase()===b.trim().toLowerCase();
const simpleId=(id,prefix)=>typeof id==='string'&&id.startsWith(prefix)&&id.length>prefix.length;

/**
 * Implementação futura: adapters devem ser criados somente por backend autenticado.
 * Nenhum método de escrita é aceito como adapter. Não tratar flags recebidas do cliente como prova.
 */
export async function inspectCommercialSubscriptionReadOnly({
 authenticatedClerkId,sessionId,adapters
}={}){
 if(!simpleId(authenticatedClerkId,'user_'))return code('AUTHENTICATED_CLERK_ID_REQUIRED');
 if(!simpleId(sessionId,'cs_live_'))return code('CHECKOUT_SESSION_ID_REQUIRED');
 const needed=[
  'getVerifiedClerkIdentity','retrieveCheckout','getServerRegistration',
  'retrieveStripeCustomer','retrieveStripeSubscription',
  'retrieveStripePrice','retrieveStripeInvoice','findBillingUser',
  'findCustomerOwner','findSubscriptionOwner','listActiveStripeSubscriptions',
  'listOtherPaymentProviderEntitlements'
 ];
 if(!adapters||needed.some(name=>typeof adapters[name]!=='function'))
  return code('READ_ONLY_ADAPTERS_MISSING');
 // Falhar fechado diante de erro de API. Não há fallback usando dados do navegador.
 try{
  const identity=await adapters.getVerifiedClerkIdentity(authenticatedClerkId);
  if(identity?.userId!==authenticatedClerkId||identity.authenticated!==true||
     identity.emailVerified!==true||!identity.email)
   return code('CLERK_IDENTITY_NOT_VERIFIED');
  const checkout=await adapters.retrieveCheckout(sessionId);
  if(checkout?.id!==sessionId||checkout.livemode!==true||
     checkout.mode!=='subscription'||checkout.status!=='complete'||
     checkout.payment_status!=='paid')
   return code('STRIPE_CHECKOUT_NOT_CONFIRMED');
  const registrationId=checkout.client_reference_id;
  if(typeof registrationId!=='string'||!registrationId||
     registrationId!==checkout.metadata?.pre_registration_id)
   return code('REGISTRATION_REFERENCE_MISMATCH');
  const registration=await adapters.getServerRegistration(registrationId);
  if(!registration||registration.id!==registrationId||
     registration.source!=='server'||!registration.email)
   return code('SERVER_REGISTRATION_NOT_FOUND');
  if(!sameEmail(identity.email,registration.email))
   return code('PAID_ACCESS_PENDING_EMAIL_REVIEW',{
    accountCorrectionRequired:true,sessionId
   });
  const plan=checkout.metadata?.plan;
  if(typeof plan!=='string'||!Object.hasOwn(OFFICIAL_MONTHLY_PLANS,plan))
   return code('PRICE_PLAN_NOT_RECOGNIZED');
  const customerId=ref(checkout.customer),subscriptionId=ref(checkout.subscription);
  if(!simpleId(customerId,'cus_')||!simpleId(subscriptionId,'sub_'))
   return code('STRIPE_CUSTOMER_OR_SUBSCRIPTION_MISSING');
  const [customer,subscription,billingUser,customerOwner,subscriptionOwner,
   activeStripeSubscriptions,otherBillingEntitlements]=await Promise.all([
    adapters.retrieveStripeCustomer(customerId),
    adapters.retrieveStripeSubscription(subscriptionId),
    adapters.findBillingUser(authenticatedClerkId),
    adapters.findCustomerOwner(customerId),
    adapters.findSubscriptionOwner(subscriptionId),
    adapters.listActiveStripeSubscriptions(customerId),
    adapters.listOtherPaymentProviderEntitlements(authenticatedClerkId)
   ]);
  const sid=ref(subscription?.latest_invoice);
  const attachedPriceId=subscription?.items?.data?.[0]?.price?.id;
  if(typeof sid!=='string'||typeof attachedPriceId!=='string')
   return code('STRIPE_INVOICE_OR_PRICE_NOT_FOUND');
  const [invoice,price]=await Promise.all([
   adapters.retrieveStripeInvoice(sid),adapters.retrieveStripePrice(attachedPriceId)
  ]);
  const verified=reviewGuestPurchase({
   plan,registration,clerk:identity,checkout,customer,subscription,invoice,
   price,billingUser,stripeCustomerOwner:customerOwner,
   stripeSubscriptionOwner:subscriptionOwner,
   activeStripeSubscriptions,otherBillingEntitlements,
   stripeServerConfirmed:true,clerkServerVerified:true
  });
  if(!verified.eligible)return code(verified.code,{accountCorrectionRequired:
   verified.code==='PENDING_EMAIL_REVIEW'});
  // Não confundir decisão de leitura com autorização para alterar o oficial.
  return code('VERIFIED_READ_ONLY_AWAITING_SAFE_CLAIM',{
   eligible:true,commercialPlan:plan,internalPlan:verified.internalPlan,
   priceId:verified.priceId,sessionId:verified.sessionId,
   verifiedClerkId:authenticatedClerkId,
   customerId:verified.customerId,subscriptionId:verified.subscriptionId,
   verifiedInvoiceId:verified.invoiceId
  });
 }catch{
  return code('TRUSTED_PROVIDER_UNAVAILABLE');
 }
}
