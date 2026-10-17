import test from 'node:test';
import assert from 'node:assert/strict';
import {OFFICIAL_MONTHLY_PLANS,getOfficialMonthlyPlan,prepareOfficialCheckout,
 createAuthorizedOfficialSession} from '../official-checkout-contract.mjs';
const rid='123e4567-e89b-42d3-a456-426614174000';
const aid='123e4567-e89b-42d3-a456-426614174001';
const options={plan:'PREMIUM',registrationId:rid,registeredEmail:'usuario@example.com'};
const identity=[
 ['START','price_1TunJ2AYtu5nLhAZPd1Ai0hD',6900,'pro'],
 ['PREMIUM','price_1TunQhAYtu5nLhAZu5QXWW31',15900,'business'],
 ['PRO','price_1TunTDAYtu5nLhAZDfzTn8Cm',29900,'agency']
];
test('cada botão identifica precisamente o Price ID já criado na Stripe oficial',()=>{
 for(const [name,id,amount,planKey] of identity){
  const r=prepareOfficialCheckout({...options,plan:name});
  assert.equal(r.ok,true);assert.equal(r.priceId,id);assert.equal(r.amountCents,amount);
  assert.equal(r.internalPlanKey,planKey);assert.equal(r.checkoutEnabled,false);
 }
 assert.equal(Object.keys(OFFICIAL_MONTHLY_PLANS).length,3);
});
test('PRO da landing mapeado a agency, não ao pro interno',()=>{
 assert.equal(getOfficialMonthlyPlan('PRO').planKey,'agency');
 assert.equal(getOfficialMonthlyPlan('START').planKey,'pro');
});
test('sem preregistro válido não há intenção de checkout',()=>{
 assert.equal(prepareOfficialCheckout({plan:'START',registrationId:rid}).code,'UNVERIFIED_PRE_REGISTRATION');
 assert.equal(prepareOfficialCheckout({plan:'START',registrationId:'tudo',registeredEmail:'x@y.com'}).code,
  'UNVERIFIED_PRE_REGISTRATION');
});
test('plano falsificado pelo navegador não tem price id aceito',()=>{
 for(const p of ['BUSINESS','FREE','pro','PRO<>',null]){
  assert.equal(prepareOfficialCheckout({...options,plan:p}).code,'UNKNOWN_COMMERCIAL_PLAN');
 }
});
test('mesmo sinalizando release sem completar a ponte não cria cobrança',async()=>{
 let remoteCalls=0;
 const api={retrievePrice:async()=>{remoteCalls++;throw Error('Nunca chamar Stripe');},
  createCheckoutSession:async()=>{remoteCalls++;throw Error('Nunca chamar Stripe')}};
 for(const changes of [{},{officialCheckoutReleased:true},
  {officialCheckoutReleased:true,bridgeReconciliationReady:true},
  {officialCheckoutReleased:true,bridgeReconciliationReady:true,authorizedProductionRelease:true}]){
  const r=await createAuthorizedOfficialSession({...options,officialStripe:api,...changes});
  assert.equal(r.code,'PAYMENT_RELEASE_GATES_CLOSED');
 }
 assert.equal(remoteCalls,0);
});
test('Stripe Price oficial precisa confirmar BRL, valor mensal e livemode',async()=>{
 for(const bad of [{unit_amount:50},{unit_amount:19900},{currency:'usd'},
  {livemode:false},{active:false},{recurring:{interval:'year',interval_count:1}},
  {id:'price_outro'}]){
  let checkoutCalls=0;
  const price={id:OFFICIAL_MONTHLY_PLANS.PREMIUM.priceId,livemode:true,active:true,
   currency:'brl',unit_amount:15900,type:'recurring',
   recurring:{interval:'month',interval_count:1},product:'prod_valid',...bad};
  const r=await createAuthorizedOfficialSession({...options,officialCheckoutReleased:true,
   bridgeReconciliationReady:true,authorizedProductionRelease:true,serverRegistrationProofVerified:true,
   callbackOrigin:'https://landing.example.com',attemptId:aid,
   officialStripe:{retrievePrice:async()=>price,
    createCheckoutSession:async()=>{checkoutCalls++;return null;}}});
  assert.equal(r.code,'STRIPE_PRICE_DOES_NOT_MATCH');assert.equal(checkoutCalls,0);
 }
});
test('sessão sintética usa apenas o Price ID oficial sem customer_email',async()=>{
 let call;
 const input={...options,officialCheckoutReleased:true,bridgeReconciliationReady:true,
  authorizedProductionRelease:true,serverRegistrationProofVerified:true,
  callbackOrigin:'https://landing.example.com',attemptId:aid,
  officialStripe:{
   retrievePrice:async id=>({id,livemode:true,active:true,
    unit_amount:15900,currency:'brl',type:'recurring',
    recurring:{interval:'month',interval_count:1},product:'prod_real'}),
   createCheckoutSession:async(fields,idempotencyKey)=>{
    call={fields,idempotencyKey};return {livemode:true,id:'cs_live_virtual',url:'https://checkout.stripe.com/c/pay/cs_live_virtual'};
   }
  }};
 const r=await createAuthorizedOfficialSession(input);
 assert.equal(r.code,'STRIPE_CHECKOUT_CREATED');assert.equal(r.accountActivated,false);
 assert.deepEqual(call.fields.line_items,[{price:identity[1][1],quantity:1}]);
 assert.equal(call.fields.subscription_data.metadata.planKey,'business');
 assert.equal(call.fields.client_reference_id,rid);
 assert.equal(call.fields.customer,undefined);
 assert.equal(call.fields.customer_email,undefined);
 assert.match(call.idempotencyKey,/commercial:/);
});
test('sessão Stripe em modo teste jamais serve para produção',async()=>{
 const r=await createAuthorizedOfficialSession({...options,
  officialCheckoutReleased:true,bridgeReconciliationReady:true,
  authorizedProductionRelease:true,serverRegistrationProofVerified:true,
  callbackOrigin:'https://landing.example.com',attemptId:aid,
  officialStripe:{retrievePrice:async id=>({id,livemode:true,active:true,
   unit_amount:15900,currency:'brl',type:'recurring',
   recurring:{interval:'month',interval_count:1},product:'prod_real'}),
   createCheckoutSession:async()=>({livemode:false,id:'cs_test_fake',url:'https://checkout.stripe.com/fake'})}});
 assert.equal(r.code,'STRIPE_LIVE_SESSION_INVALID');
});
