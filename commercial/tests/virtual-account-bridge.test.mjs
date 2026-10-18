import test from 'node:test';
import assert from 'node:assert/strict';
import {OFFICIAL_MONTHLY_PLANS} from '../official-checkout-contract.mjs';
import {reviewGuestPurchase,createVirtualLedger} from '../virtual-account-bridge.mjs';
const registration={id:'123e4567-e89b-42d3-a456-426614174000',email:'buyer@example.com',source:'server'};
function fixture(plan='PREMIUM'){
 const p=OFFICIAL_MONTHLY_PLANS[plan];
 return {plan,registration:{...registration},
  clerk:{userId:'user_buyer',email:' Buyer@Example.Com ',authenticated:true,emailVerified:true},
  clerkServerVerified:true,stripeServerConfirmed:true,
  checkout:{id:'cs_live_mock',livemode:true,mode:'subscription',status:'complete',
   payment_status:'paid',client_reference_id:registration.id,
   metadata:{plan,pre_registration_id:registration.id},customer:'cus_mock',
   subscription:'sub_mock',currency:'brl',amount_total:p.amountCents,
   customer_details:{email:'payer@example.com'}},
  customer:{id:'cus_mock',livemode:true,email:'payer@example.com'},
  subscription:{id:'sub_mock',livemode:true,status:'active',customer:'cus_mock',
   metadata:{pre_registration_id:registration.id,planKey:p.planKey},
   items:{data:[{price:{id:p.priceId}}]},latest_invoice:'in_mock'},
  price:{id:p.priceId,livemode:true,active:true,currency:'brl',
   unit_amount:p.amountCents,type:'recurring',recurring:{interval:'month',interval_count:1}},
  invoice:{id:'in_mock',livemode:true,paid:true,status:'paid',
   customer:'cus_mock',subscription:'sub_mock',currency:'brl',
   amount_paid:p.amountCents,billingPeriodKey:'2026-10'},
  billingUser:{clerkId:'user_buyer',email:registration.email,
   stripeCustomerId:null,stripeSubscriptionId:null},
  activeStripeSubscriptions:[{id:'sub_mock',customerId:'cus_mock',status:'active'}],
  otherBillingEntitlements:[]};
}
const run=x=>reviewGuestPurchase({...fixture(),...x});
const ledger=()=>createVirtualLedger({fictionalCredits:{pro:7,business:13,agency:19}});
test('três planos e Price IDs corretos sem atribuição real',()=>{
 for(const plan of ['START','PREMIUM','PRO']){
  const r=reviewGuestPurchase(fixture(plan));
  assert.equal(r.eligible,true);assert.equal(r.priceId,OFFICIAL_MONTHLY_PLANS[plan].priceId);
  assert.equal(r.internalPlan,OFFICIAL_MONTHLY_PLANS[plan].planKey);
  assert.equal(r.creditsGranted,0);assert.equal(r.accountActivated,false);
 }
});
test('email de cartão e Stripe Customer diferente do Clerk é permitido',()=>{
 const r=run();assert.equal(r.eligible,true);assert.equal(r.clerkUserId,'user_buyer');
});
test('email do Clerk diferente preserva pagamento e marca revisão',()=>{
 const x=fixture();x.clerk.email='outro@example.com';
 const r=reviewGuestPurchase(x);assert.equal(r.code,'PENDING_EMAIL_REVIEW');
 assert.equal(r.paymentUnchanged,true);assert.equal(r.accountActivated,false);
});
test('prova de identidade deve vir do Clerk verificado no servidor',()=>{
 assert.equal(run({clerkServerVerified:false}).code,'CLERK_VERIFICATION_REQUIRED');
 const x=fixture();x.clerk.emailVerified=false;
 assert.equal(reviewGuestPurchase(x).code,'CLERK_VERIFICATION_REQUIRED');
});
test('pré-cadastro deve vir do armazenamento do servidor',()=>{
 assert.equal(run({registration:{...registration,source:'browser'}}).code,'REGISTRATION_NOT_SERVER_STORED');
});
test('prova Stripe e checkout pago precisam ser confirmados',()=>{
 assert.equal(run({stripeServerConfirmed:false}).code,'TRUSTED_STRIPE_CONFIRMATION_REQUIRED');
 for(const change of [{livemode:false},{payment_status:'unpaid'},
   {amount_total:50},{client_reference_id:'outro'}]){
  const x=fixture();Object.assign(x.checkout,change);
  assert.equal(reviewGuestPurchase(x).code,'CHECKOUT_MISMATCH');
 }
});
test('não confunde priceId, BRL, valor nem periodicidade de assinatura',()=>{
 for(const change of [{id:'price_wrong'},{unit_amount:50},{currency:'usd'},
   {recurring:{interval:'year',interval_count:1}}]){
  const x=fixture();Object.assign(x.price,change);
  assert.equal(reviewGuestPurchase(x).code,'PRICE_NOT_EXACT');
 }
});
test('assinatura ativa e priceId exato são mandatórios',()=>{
 for(const change of [{status:'past_due'},{customer:'cus_other'}]){
  const x=fixture();Object.assign(x.subscription,change);
  assert.equal(reviewGuestPurchase(x).code,'SUBSCRIPTION_MISMATCH');
 }
 const x=fixture();x.subscription.items.data[0].price.id='price_wrong';
 assert.equal(reviewGuestPurchase(x).code,'PRICE_NOT_EXACT');
});
test('invoice confirmada e vinculada ao customer/subscription',()=>{
 for(const change of [{paid:false},{status:'open'},{subscription:'sub_other'},{amount_paid:50}]){
  const x=fixture();Object.assign(x.invoice,change);
  assert.equal(reviewGuestPurchase(x).code,'INVOICE_NOT_PAID');
 }
});
test('outra assinatura Stripe ativa não é substituída',()=>{
 const x=fixture();x.activeStripeSubscriptions.push({id:'sub_extra',customerId:'cus_mock',status:'active'});
 assert.equal(reviewGuestPurchase(x).code,'DUPLICATE_STRIPE_SUBSCRIPTIONS_REVIEW');
});
test('não toma assinatura nem Customer de usuário existente',()=>{
 for(const key of ['stripeCustomerId','stripeSubscriptionId']){
  const x=fixture();x.billingUser[key]='wrong_value';
  assert.match(reviewGuestPurchase(x).code,/EXISTING_OTHER_/);
 }
 assert.equal(run({stripeCustomerOwner:'user_other'}).code,'CUSTOMER_OWNED_BY_ANOTHER_USER');
 assert.equal(run({stripeSubscriptionOwner:'user_other'}).code,'SUBSCRIPTION_OWNED_BY_ANOTHER_USER');
});
test('assinatura existente de outro canal exige revisão',()=>{
 assert.equal(run({otherBillingEntitlements:[{provider:'google_play',active:true}]}).code,
  'GOOGLE_PLAY_OR_OTHER_ENTITLEMENT_REVIEW');
});
test('conta virtual mostra PREMIUM com franquia fictícia, oficial intocado',async()=>{
 const l=ledger(),r=await l.claim(run());
 assert.equal(r.code,'VIRTUAL_PLAN_RECOGNIZED');assert.equal(r.virtualCreditsAdded,13);
 assert.equal(r.creditsGranted,0);assert.equal(l.view('user_buyer').virtualPlan,'PREMIUM');
 assert.equal(l.view('user_buyer').virtualCredits,13);
 assert.equal(l.view('user_unknown').virtualPlan,null);
});
test('retry de webhook não projeta créditos novamente',async()=>{
 const l=ledger(),decision=run();
 const first=await l.claim(decision),second=await l.claim(decision);
 assert.equal(first.virtualCreditsAdded,13);assert.equal(second.virtualCreditsAdded,0);
 assert.equal(second.code,'ALREADY_VIRTUALLY_LINKED');assert.equal(l.counts().sessions,1);
});
test('20 reconciliações concorrentes não multiplicam a franquia virtual',async()=>{
 const l=ledger(),decision=run();
 const responses=await Promise.all(Array.from({length:20},()=>l.claim(decision)));
 assert.equal(responses.filter(x=>x.code==='VIRTUAL_PLAN_RECOGNIZED').length,1);
 assert.equal(responses.reduce((n,x)=>n+(x.virtualCreditsAdded||0),0),13);
});
test('tentativa de roubar claim já consolidado é bloqueada',async()=>{
 const l=ledger(),v=run();await l.claim(v);
 assert.equal((await l.claim({...v,clerkUserId:'user_outro'})).code,'CLAIM_OWNER_CONFLICT');
});
test('segunda compra na mesma conta fica para análise, sem novo crédito',async()=>{
 const l=ledger(),v=run();await l.claim(v);
 const second=await l.claim({...v,sessionId:'cs_live_second',subscriptionId:'sub_second',
  customerId:'cus_second'});
 assert.equal(second.code,'ANOTHER_PURCHASE_OR_OWNER_REVIEW');
 assert.equal(l.counts().sessions,1);
});
test('evidência rejeitada não modifica ledger',async()=>{
 const l=ledger();
 assert.equal((await l.claim(run({stripeServerConfirmed:false}))).code,'VIRTUAL_EVIDENCE_INVALID');
 assert.equal(l.counts().sessions,0);
});
test('sem franquia fictícia definida não concede nada',async()=>{
 const l=createVirtualLedger(),r=await l.claim(run());
 assert.equal(r.code,'FICTIONAL_CREDIT_POLICY_MISSING');
 assert.equal(l.counts().sessions,0);
});
