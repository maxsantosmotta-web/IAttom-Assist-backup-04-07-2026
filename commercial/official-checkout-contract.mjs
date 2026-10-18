/**
 * Contrato de checkout oficial. SEM side effects: a criação de sessão só é
 * executada se TODAS as autorizações forem fornecidas por código de servidor.
 * Este módulo não tem acesso a chave Stripe, banco, Clerk nem rede.
 */
import {prepareSignedGuestCheckoutMetadata} from './guest-checkout-metadata.mjs';
export const OFFICIAL_MONTHLY_PLANS=Object.freeze({
 START:Object.freeze({priceId:'price_1TunJ2AYtu5nLhAZPd1Ai0hD',amountCents:6900,planKey:'pro'}),
 PREMIUM:Object.freeze({priceId:'price_1TunQhAYtu5nLhAZu5QXWW31',amountCents:15900,planKey:'business'}),
 PRO:Object.freeze({priceId:'price_1TunTDAYtu5nLhAZDfzTn8Cm',amountCents:29900,planKey:'agency'})
});
const isUuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const fail=(code,info={})=>({ok:false,mode:'official',code,
 checkoutEnabled:false,realPayments:false,accountActivated:false,creditsGranted:0,...info});
const ref=x=>typeof x==='string'?x:x?.id;
export function getOfficialMonthlyPlan(name){
 return typeof name==='string'&&Object.hasOwn(OFFICIAL_MONTHLY_PLANS,name)
   ?OFFICIAL_MONTHLY_PLANS[name]:null;
}
export function prepareOfficialCheckout({
 plan,registrationId,registeredEmail,officialCheckoutReleased=false
}={}){
 const match=getOfficialMonthlyPlan(plan);
 if(!match)return fail('UNKNOWN_COMMERCIAL_PLAN');
 if(!isUuid(registrationId)||typeof registeredEmail!=='string'||!registeredEmail.includes('@'))
   return fail('UNVERIFIED_PRE_REGISTRATION');
 return {ok:true,mode:'official',plan,priceId:match.priceId,amountCents:match.amountCents,
  currency:'brl',billingInterval:'month',internalPlanKey:match.planKey,
  code:officialCheckoutReleased?'PREPARED_AWAITING_BRIDGE_GATE':'OFFICIAL_PRICE_LINK_PREPARED',
  checkoutEnabled:false,realPayments:false,accountActivated:false,creditsGranted:0};
}
/**
 * Um futuro backend autorizado poderá injetar API Stripe autenticada.
 * Nunca invoque com permissões derivadas de dados enviados pelo navegador.
 * O preview mantém as quatro autorizações abaixo sempre FALSE.
 */
export async function createAuthorizedOfficialSession({
 plan,registrationId,registeredEmail,
 officialCheckoutReleased=false,bridgeReconciliationReady=false,
 authorizedProductionRelease=false,serverRegistrationProofVerified=false,
 callbackOrigin,officialStripe,attemptId,sharedSigningKey,proofIssuedAt
}={}){
 const prepared=prepareOfficialCheckout({plan,registrationId,registeredEmail,officialCheckoutReleased});
 if(!prepared.ok)return prepared;
 if(officialCheckoutReleased!==true||bridgeReconciliationReady!==true||
    authorizedProductionRelease!==true||serverRegistrationProofVerified!==true)
   return fail('PAYMENT_RELEASE_GATES_CLOSED',{plan,priceId:prepared.priceId,prepared:true});
 if(!officialStripe||typeof officialStripe.retrievePrice!=='function'||
    typeof officialStripe.createCheckoutSession!=='function')
   return fail('OFFICIAL_STRIPE_ADAPTER_NOT_CONFIGURED');
 if(typeof callbackOrigin!=='string'||!/^https:\/\/[a-z0-9.-]+(?::443)?$/i.test(callbackOrigin)||
    typeof attemptId!=='string'||!isUuid(attemptId))
   return fail('SECURE_RETURN_OR_IDEMPOTENCY_MISSING');
 const p=await officialStripe.retrievePrice(prepared.priceId);
 if(!p||p.id!==prepared.priceId||p.livemode!==true||p.active!==true||
   p.currency!=='brl'||p.unit_amount!==prepared.amountCents||
   p.type!=='recurring'||p.recurring?.interval!=='month'||p.recurring?.interval_count!==1||
   !ref(p.product)?.startsWith('prod_'))
   return fail('STRIPE_PRICE_DOES_NOT_MATCH',{plan,priceId:prepared.priceId});
 // Sem um vínculo assinado verificável pelo backend, não pode haver Checkout real.
 // Timestamp é produzido pelo servidor no INSTANTE da sessão (nunca pelo browser).
 let signed;
 try{
  signed=prepareSignedGuestCheckoutMetadata({
   registrationId,registrationEmail:registeredEmail,plan,
   issuedAt:proofIssuedAt,sharedSigningKey
  });
  if(signed.priceId!==prepared.priceId||
     signed.client_reference_id!==registrationId.toLowerCase())
   return fail('SIGNED_REGISTRATION_PROOF_MISMATCH');
 }catch{
  return fail('SIGNED_REGISTRATION_PROOF_REQUIRED');
 }
 // O email do pagador (Stripe Customer) NÃO é forçado ao email do pré-cadastro.
 // Não criar customer antes do checkout: Stripe captura email de pagamento livremente.
 // Reclamar acesso exige, em outro módulo, webhook autenticado e Clerk email verificado.
 const session=await officialStripe.createCheckoutSession({
  mode:'subscription',client_reference_id:registrationId,
  line_items:[{price:prepared.priceId,quantity:1}],
  success_url:callbackOrigin+'/?checkout=retorno&session_id={CHECKOUT_SESSION_ID}#planos',
  cancel_url:callbackOrigin+'/?checkout=cancelado#planos',
  metadata:signed.metadata,
  subscription_data:signed.subscription_data
 },'commercial:'+registrationId+':'+plan+':'+attemptId);
 if(!session||session.livemode!==true||!session.id?.startsWith('cs_live_')||
   typeof session.url!=='string'||!/^https:\/\/checkout\.stripe\.com\//.test(session.url))
   return fail('STRIPE_LIVE_SESSION_INVALID',{plan});
 return {ok:true,mode:'official',plan,priceId:prepared.priceId,
  code:'STRIPE_CHECKOUT_CREATED',url:session.url,sessionId:session.id,
  checkoutEnabled:true,realPayments:true,accountActivated:false,creditsGranted:0};
}
