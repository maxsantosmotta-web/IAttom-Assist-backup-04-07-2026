import test from 'node:test';
import assert from 'node:assert/strict';
import {OFFICIAL_MONTHLY_PLANS} from '../official-checkout-contract.mjs';
import {inspectCommercialSubscriptionReadOnly} from '../commercial-preflight-readonly.mjs';
const rid='123e4567-e89b-42d3-a456-426614174000';
const fixtures=(plan='PREMIUM')=>{
 const spec=OFFICIAL_MONTHLY_PLANS[plan];
 const checkout={id:'cs_live_sample',livemode:true,mode:'subscription',status:'complete',
  payment_status:'paid',client_reference_id:rid,
  metadata:{pre_registration_id:rid,plan},customer:'cus_sample',
  subscription:'sub_sample',currency:'brl',amount_total:spec.amountCents,
  customer_details:{email:'titular-cartao@example.com'}};
 const identity={userId:'user_comprador',authenticated:true,
  email:'comprador@example.com',emailVerified:true};
 const reg={id:rid,email:'comprador@example.com',source:'server'};
 const sub={id:'sub_sample',livemode:true,status:'active',customer:'cus_sample',
  items:{data:[{price:{id:spec.priceId}}]},
  metadata:{pre_registration_id:rid,planKey:spec.planKey},latest_invoice:'in_sample'};
 const invoice={id:'in_sample',livemode:true,paid:true,status:'paid',
  customer:'cus_sample',subscription:'sub_sample',currency:'brl',
  amount_paid:spec.amountCents,billingPeriodKey:'2026-10'};
 const price={id:spec.priceId,livemode:true,active:true,
  currency:'brl',unit_amount:spec.amountCents,type:'recurring',
  recurring:{interval:'month',interval_count:1}};
 const state={identity,reg,checkout,sub,invoice,price,
  user:{clerkId:'user_comprador',email:'comprador@example.com',
   stripeCustomerId:null,stripeSubscriptionId:null},
  active:[{id:'sub_sample',customerId:'cus_sample',status:'active'}],
  providerEntitlements:[],customerOwner:null,subscriptionOwner:null,
  reads:[],writes:0};
 const read=(name,f)=>async(...args)=>{state.reads.push(name);return f(...args)};
 const adapters={
  getVerifiedClerkIdentity:read('clerk',()=>state.identity),
  retrieveCheckout:read('checkout',()=>state.checkout),
  getServerRegistration:read('registration',()=>state.reg),
  retrieveStripeCustomer:read('customer',()=>({id:'cus_sample',livemode:true})),
  retrieveStripeSubscription:read('subscription',()=>state.sub),
  retrieveStripePrice:read('price',()=>state.price),
  retrieveStripeInvoice:read('invoice',()=>state.invoice),
  findBillingUser:read('user',()=>state.user),
  findCustomerOwner:read('customer-owner',()=>state.customerOwner),
  findSubscriptionOwner:read('subscription-owner',()=>state.subscriptionOwner),
  listActiveStripeSubscriptions:read('active-subs',()=>state.active),
  listOtherPaymentProviderEntitlements:read('other-providers',()=>state.providerEntitlements)
 };
 return {state,adapters};
};
const request=x=>({authenticatedClerkId:'user_comprador',
 sessionId:'cs_live_sample',adapters:x});
test('START PREMIUM PRO corretos: preflight comprova Price ID em read-only',async()=>{
 for(const plan of ['START','PREMIUM','PRO']){
  const {adapters}=fixtures(plan);
  const r=await inspectCommercialSubscriptionReadOnly(request(adapters));
  assert.equal(r.code,'VERIFIED_READ_ONLY_AWAITING_SAFE_CLAIM');
  assert.equal(r.eligible,true);assert.equal(r.priceId,OFFICIAL_MONTHLY_PLANS[plan].priceId);
  assert.equal(r.internalPlan,OFFICIAL_MONTHLY_PLANS[plan].planKey);
  assert.equal(r.creditsGranted,0);assert.equal(r.accountActivated,false);
  assert.equal(r.productionWrites,0);assert.equal(r.readyForProduction,false);
 }
});
test('pagamento com e-mail de terceiro permanece elegível para dono verificado',async()=>{
 const {state,adapters}=fixtures();
 state.checkout.customer_details.email='outra-pessoa@example.com';
 const r=await inspectCommercialSubscriptionReadOnly(request(adapters));
 assert.equal(r.eligible,true);
});
test('não aceita identidade Clerk ausente ou não autenticada',async()=>{
 const {state,adapters}=fixtures();state.identity.authenticated=false;
 const r=await inspectCommercialSubscriptionReadOnly(request(adapters));
 assert.equal(r.code,'CLERK_IDENTITY_NOT_VERIFIED');
 assert.deepEqual(state.reads,['clerk']);
});
test('Clerk não verificado interrompe antes de consultar compra',async()=>{
 const {state,adapters}=fixtures();state.identity.emailVerified=false;
 assert.equal((await inspectCommercialSubscriptionReadOnly(request(adapters))).code,
  'CLERK_IDENTITY_NOT_VERIFIED');
 assert.equal(state.reads.length,1);
});
test('userId autenticado diferente da identidade Clerk é rejeitado',async()=>{
 const {state,adapters}=fixtures();state.identity.userId='user_outro';
 assert.equal((await inspectCommercialSubscriptionReadOnly(request(adapters))).code,
  'CLERK_IDENTITY_NOT_VERIFIED');
 assert.deepEqual(state.reads,['clerk']);
});
test('email da conta diferente do cadastro pago preserva pagamento',async()=>{
 const {state,adapters}=fixtures();state.identity.email='outro@example.com';
 const r=await inspectCommercialSubscriptionReadOnly(request(adapters));
 assert.equal(r.code,'PAID_ACCESS_PENDING_EMAIL_REVIEW');
 assert.equal(r.paymentUnchanged,true);assert.equal(r.accountActivated,false);
 assert.deepEqual(state.reads,['clerk','checkout','registration']);
});
test('checkout que ainda não foi pago bloqueia consulta dos dados de pessoa',async()=>{
 const {state,adapters}=fixtures();state.checkout.payment_status='unpaid';
 const r=await inspectCommercialSubscriptionReadOnly(request(adapters));
 assert.equal(r.code,'STRIPE_CHECKOUT_NOT_CONFIRMED');
 assert.deepEqual(state.reads,['clerk','checkout']);
});
test('referência do pré-cadastro não bate com Stripe',async()=>{
 const {state,adapters}=fixtures();state.checkout.client_reference_id='outro_id';
 const r=await inspectCommercialSubscriptionReadOnly(request(adapters));
 assert.equal(r.code,'REGISTRATION_REFERENCE_MISMATCH');
 assert.deepEqual(state.reads,['clerk','checkout']);
});
test('preregistro inexistente ou apenas informado pelo browser é rejeitado',async()=>{
 const {state,adapters}=fixtures();state.reg.source='browser';
 assert.equal((await inspectCommercialSubscriptionReadOnly(request(adapters))).code,
  'SERVER_REGISTRATION_NOT_FOUND');
});
test('não aceita Price ID diferente mesmo com metadata de PREMIUM',async()=>{
 const {state,adapters}=fixtures();state.price.id=OFFICIAL_MONTHLY_PLANS.PRO.priceId;
 assert.equal((await inspectCommercialSubscriptionReadOnly(request(adapters))).code,
  'PRICE_NOT_EXACT');
});
test('não aceita valor de 50 centavos apesar de Price ID informado',async()=>{
 const {state,adapters}=fixtures();state.price.unit_amount=50;
 assert.equal((await inspectCommercialSubscriptionReadOnly(request(adapters))).code,
  'PRICE_NOT_EXACT');
});
test('assinatura já associada a outro usuário fica em revisão',async()=>{
 const {state,adapters}=fixtures();state.subscriptionOwner='user_vitima';
 assert.equal((await inspectCommercialSubscriptionReadOnly(request(adapters))).code,
  'SUBSCRIPTION_OWNED_BY_ANOTHER_USER');
});
test('cliente existente com outra assinatura fica protegido',async()=>{
 const {state,adapters}=fixtures();state.user.stripeSubscriptionId='sub_antiga';
 assert.equal((await inspectCommercialSubscriptionReadOnly(request(adapters))).code,
  'EXISTING_OTHER_SUBSCRIPTION');
});
test('duas assinaturas Stripe ativas geram revisão',async()=>{
 const {state,adapters}=fixtures();state.active.push({
  id:'sub_another',customerId:'cus_sample',status:'active'});
 assert.equal((await inspectCommercialSubscriptionReadOnly(request(adapters))).code,
  'DUPLICATE_STRIPE_SUBSCRIPTIONS_REVIEW');
});
test('assinatura Google Play ativa fica protegida',async()=>{
 const {state,adapters}=fixtures();state.providerEntitlements.push({
  provider:'google_play',active:true});
 assert.equal((await inspectCommercialSubscriptionReadOnly(request(adapters))).code,
  'GOOGLE_PLAY_OR_OTHER_ENTITLEMENT_REVIEW');
});
test('falta de adaptador falha fechado',async()=>{
 const {adapters}=fixtures();delete adapters.retrieveStripePrice;
 assert.equal((await inspectCommercialSubscriptionReadOnly(request(adapters))).code,
  'READ_ONLY_ADAPTERS_MISSING');
});
test('falha de Stripe ou Clerk não concede acesso por fallback',async()=>{
 const {adapters}=fixtures();
 adapters.retrieveStripeInvoice=async()=>{throw Error('API timeout')};
 const r=await inspectCommercialSubscriptionReadOnly(request(adapters));
 assert.equal(r.code,'TRUSTED_PROVIDER_UNAVAILABLE');assert.equal(r.creditsGranted,0);
});
test('inputs do browser não sobrescrevem identificação de plano e email',async()=>{
 const {state,adapters}=fixtures();
 const result=await inspectCommercialSubscriptionReadOnly({
  ...request(adapters),plan:'PRO',priceId:OFFICIAL_MONTHLY_PLANS.START.priceId,
  email:'atacante@example.com',amountCents:50});
 assert.equal(result.eligible,true);
 assert.equal(result.commercialPlan,'PREMIUM');
 assert.equal(result.priceId,OFFICIAL_MONTHLY_PLANS.PREMIUM.priceId);
 assert.equal(state.writes,0);
});
test('sem session id ou Clerk autenticado não faz nenhuma consulta',async()=>{
 const {state,adapters}=fixtures();
 assert.equal((await inspectCommercialSubscriptionReadOnly({
  ...request(adapters),sessionId:'cs_test_bad'})).code,'CHECKOUT_SESSION_ID_REQUIRED');
 assert.equal((await inspectCommercialSubscriptionReadOnly({
  ...request(adapters),authenticatedClerkId:'visitor'})).code,
  'AUTHENTICATED_CLERK_ID_REQUIRED');
 assert.equal(state.reads.length,0);
});
test('duas consultas concorrentes só leem dados e não ativam nada',async()=>{
 const {state,adapters}=fixtures();
 const r=await Promise.all(Array.from({length:10},()=>inspectCommercialSubscriptionReadOnly(request(adapters))));
 assert.equal(r.length,10);assert(r.every(v=>v.creditsGranted===0&&v.productionWrites===0));
 assert.equal(state.writes,0);
});
