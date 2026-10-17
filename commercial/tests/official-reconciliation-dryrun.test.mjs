import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareOfficialReconciliationDryRun} from '../official-reconciliation-dryrun.mjs';
const registrationId='11111111-1111-4111-8111-111111111111',mail='comprador@example.com';
function setup(){
 const pending={sessionId:'cs_test_virtual',customerId:'cus_virtual',registrationId,
   plan:'PREMIUM',legacyPlanKey:'business',amountBRL:15900,
   paymentStatus:'PAID_TEST',pendingStatus:'WAITING_VERIFIED_CLERK',accountActivated:false};
 const clerk={trustedServerVerification:true,authenticated:true,emailVerified:true,
   clerkUserId:'user_virtual',email:mail};
 const checkout={id:pending.sessionId,livemode:false,mode:'subscription',status:'complete',
   payment_status:'paid',client_reference_id:registrationId,customer:'cus_virtual',
   subscription:'sub_virtual',currency:'brl',amount_total:15900,
   metadata:{plan:'PREMIUM',pre_registration_id:registrationId}};
 const subscription={id:'sub_virtual',livemode:false,customer:'cus_virtual',status:'active',
   metadata:{planKey:'business',pre_registration_id:registrationId},latest_invoice:'in_virtual',
   items:{data:[{price:{id:'price_FAKEpremium1',livemode:false,currency:'brl',
     unit_amount:15900,type:'recurring',recurring:{interval:'month',interval_count:1}}}]}};
 const invoice={id:'in_virtual',livemode:false,paid:true,status:'paid',
   customer:'cus_virtual',subscription:'sub_virtual',currency:'brl',amount_paid:15900};
 const user={clerkUserId:'user_virtual',email:mail,stripeCustomerId:null,stripeSubscriptionId:null};
 const state={claimVerified:true,owner:null,recordedClaim:null,active:[{id:'sub_virtual',status:'active'}]};
 const adapters={getClerkIdentity:async()=>clerk,
   verifyRegistrationClaim:async()=>state.claimVerified,
   retrieveCheckout:async()=>checkout,
   retrieveSubscription:async()=>subscription,
   retrieveInvoice:async()=>invoice,
   listActiveSubscriptions:async()=>state.active,
   getBillingUser:async()=>user,
   findCustomerOwner:async()=>state.owner,
   findRecordedClaim:async()=>state.recordedClaim};
 const run=()=>prepareOfficialReconciliationDryRun({pending,registeredEmail:mail,
   testPriceIds:{PREMIUM:'price_FAKEpremium1'},adapters});
 return {pending,clerk,checkout,subscription,invoice,user,state,adapters,run};
}
test('prévia aprovada não ativa conta e não credita',async()=>{
 const r=await setup().run();
 assert.equal(r.eligible,true);assert.equal(r.code,'READY_FOR_AUTHORIZED_REVIEW');
 assert.equal(r.accountActivated,false);assert.equal(r.creditsGranted,0);
 assert.equal(r.requiresOfficialAuthorization,true);
 assert(r.proposedChecks.includes('unique_claim_transaction'));
});
test('Clerk precisa autenticar e verificar e-mail na camada servidor',async()=>{
 for(const changed of [{authenticated:false},{trustedServerVerification:false},
   {emailVerified:false},{email:'outro@example.com'},{clerkUserId:''}]){
   const f=setup();Object.assign(f.clerk,changed);
   assert.equal((await f.run()).code,'CLERK_IDENTITY_NOT_VERIFIED');
 }
});
test('exige prova forte da compra além de e-mail coincidente',async()=>{
 const f=setup();f.state.claimVerified=false;
 assert.equal((await f.run()).code,'PURCHASE_CLAIM_NOT_PROVEN');
});
test('checkout inválido é bloqueado',async()=>{
 for(const changed of [{livemode:true},{status:'open'},{payment_status:'unpaid'},
   {customer:'cus_outro'},{amount_total:50},{client_reference_id:'alheio'},
   {metadata:{pre_registration_id:registrationId,plan:'PRO'}}]){
   const f=setup();Object.assign(f.checkout,changed);
   assert.equal((await f.run()).code,'STRIPE_CHECKOUT_MISMATCH');
 }
});
test('alterar assinatura do checkout bloqueia na validação da assinatura',async()=>{
 const f=setup();f.checkout.subscription='sub_outra';
 assert.equal((await f.run()).code,'STRIPE_SUBSCRIPTION_MISMATCH');
});
test('assinatura deve estar ativa e vinculada ao mesmo cliente e plano',async()=>{
 for(const changed of [{status:'canceled'},{status:'trialing'},{livemode:true},
   {customer:'cus_outro'},{metadata:{planKey:'agency',pre_registration_id:registrationId}},
   {items:{data:[]}}]){
   const f=setup();Object.assign(f.subscription,changed);
   assert.equal((await f.run()).code,'STRIPE_SUBSCRIPTION_MISMATCH');
 }
});
test('confere price id, valor, BRL, assinatura mensal e test mode',async()=>{
 for(const changed of [{id:'price_outro'},{livemode:true},{unit_amount:50},
   {currency:'usd'},{recurring:{interval:'year',interval_count:1}}]){
   const f=setup();Object.assign(f.subscription.items.data[0].price,changed);
   assert.equal((await f.run()).code,'STRIPE_PRICE_MISMATCH');
 }
});
test('fatura deve ser paga, do mesmo cliente, assinatura e preço',async()=>{
 for(const changed of [{paid:false},{status:'open'},{livemode:true},
   {customer:'cus_outro'},{subscription:'sub_outro'},{amount_paid:50}]){
   const f=setup();Object.assign(f.invoice,changed);
   assert.equal((await f.run()).code,'INVOICE_NOT_CONFIRMED');
 }
});
test('não aceita duas assinaturas ativas do mesmo customer',async()=>{
 const f=setup();f.state.active.push({id:'sub_outra',status:'active'});
 assert.equal((await f.run()).code,'DUPLICATE_OR_MISSING_STRIPE_SUBSCRIPTION');
});
test('recusa ownership alheio, assinatura existente e e-mail divergente',async()=>{
 for(const mutate of [f=>f.state.owner='user_outra',
   f=>f.user.stripeCustomerId='cus_outra',f=>f.user.stripeSubscriptionId='sub_outra',
   f=>f.user.email='outro@example.com']){
   const f=setup();mutate(f);assert.equal((await f.run()).eligible,false);
 }
});
test('replay de claim já conciliado não altera créditos',async()=>{
 const f=setup();f.state.recordedClaim={clerkUserId:'user_virtual',
   subscriptionId:'sub_virtual',status:'RECONCILED'};
 const r=await f.run();assert.equal(r.code,'ALREADY_RECONCILED');
 assert.equal(r.creditsGranted,0);
});
test('claim pertencente a outra pessoa é conflito',async()=>{
 const f=setup();f.state.recordedClaim={clerkUserId:'user_outra',
 subscriptionId:'sub_virtual',status:'RECONCILED'};
 assert.equal((await f.run()).code,'PREVIOUS_CLAIM_CONFLICT');
});
test('pendência duplicada, pagamento inválido e fonte incompleta são bloqueados',async()=>{
 const f=setup();f.pending.pendingStatus='REVIEW_DUPLICATE_PURCHASE';
 assert.equal((await f.run()).code,'NO_CONFIRMED_GUEST_HANDOFF');
 const g=setup();g.pending.paymentStatus='FAILED_TEST';
 assert.equal((await g.run()).code,'NO_CONFIRMED_GUEST_HANDOFF');
 const h=setup();delete h.adapters.retrieveInvoice;
 assert.equal((await h.run()).code,'TRUSTED_ADAPTERS_MISSING');
});
