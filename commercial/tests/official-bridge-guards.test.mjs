import test from 'node:test';
import assert from 'node:assert/strict';
import {auditUserSync,auditDeletion,auditClaim} from '../official-bridge-guards.mjs';
const identity={serverVerified:true,emailVerified:true,userId:'user_ok',email:' Cliente@Example.com '};
const example={bridgeEnabled:true,identity,registration:{id:'reg_one',email:'cliente@example.com'},
 paidStripe:{serverVerified:true,invoicePaid:true,subscriptionActive:true,
 customerId:'cus_one',subscriptionId:'sub_one',checkoutId:'cs_test_one',registrationId:'reg_one',
 payerEmail:'pagador@example.com'},existingUser:{clerkId:'user_ok',email:'cliente@example.com',
 stripeCustomerId:null,stripeSubscriptionId:null},plansApproved:true,uniqueDatabaseConstraints:true};
const check=x=>auditClaim({...example,...x});
test('Clerk verificado identifica conta sem mudar role',()=>{
 const r=auditUserSync({identity,requestedEmail:'cliente@example.com'});
 assert.equal(r.safe,true);assert.equal(r.noAutomaticRoleChange,true);
});
test('email declarado diferente nao e confiavel',()=>{
 assert.equal(auditUserSync({identity,requestedEmail:'falso@example.com'}).code,'CLIENT_EMAIL_MISMATCH');
});
test('nao reassocia contas do outro Clerk',()=>{
 assert.equal(auditUserSync({identity,recordByEmail:{clerkId:'user_other'}}).code,'ACCOUNT_REASSIGNMENT_BLOCKED');
});
test('Clerk sem email verificado e recusado para associacao',()=>{
 assert.equal(auditUserSync({identity:{...identity,emailVerified:false}}).safe,false);
});
test('cancelamento de contrato velho nao rebaixa novo ativo e pago',()=>{
 const r=auditDeletion({deletedSubscriptionId:'sub_old',customerId:'cus_one',
 activeUserSubscriptionId:'sub_new',authoritativeStripe:true,
 remainingSubscriptions:[{id:'sub_new',customerId:'cus_one',status:'active',paidInvoice:true}]});
 assert.equal(r.code,'KEEP_EXISTING_PAID_SUBSCRIPTION');
});
test('cancelamento preserva contrato remanescente pago',()=>{
 const r=auditDeletion({deletedSubscriptionId:'sub_old',customerId:'cus_one',authoritativeStripe:true,
 remainingSubscriptions:[{id:'sub_new',customerId:'cus_one',status:'active',paidInvoice:true}]});
 assert.equal(r.code,'KEEP_REMAINING_PAID_SUBSCRIPTION');
});
test('nao executa cancelamento sem fonte Stripe confiavel',()=>{
 assert.equal(auditDeletion({deletedSubscriptionId:'sub_old',customerId:'cus_one'}).code,'STRIPE_STATUS_NOT_VERIFIED');
});
test('situacao nao resolvida de outra assinatura bloqueia rebaixamento',()=>{
 const r=auditDeletion({deletedSubscriptionId:'sub_old',customerId:'cus_one',authoritativeStripe:true,
 remainingSubscriptions:[{id:'sub_new',customerId:'cus_one',status:'past_due',paidInvoice:false}]});
 assert.equal(r.code,'REMAINING_SUBSCRIPTION_UNRESOLVED');
});
test('sem assinatura restante apenas solicita revisao, nao muda plano',()=>{
 const r=auditDeletion({deletedSubscriptionId:'sub_old',customerId:'cus_one',authoritativeStripe:true,
 remainingSubscriptions:[]});assert.equal(r.code,'REVIEW_DOWNGRADE_ONLY');assert.equal(r.productionWrites,0);
});
test('flag desativada bloqueia nova ponte',()=>{
 assert.equal(check({bridgeEnabled:false}).code,'FEATURE_DISABLED');
});
test('pagador diferente e aceito no desenho, sem liberar acesso',()=>{
 const r=check();assert.equal(r.safe,true);assert.equal(r.accountActivated,false);assert.equal(r.creditsGranted,0);
});
test('Clerk divergente do preregistro bloqueia vinculo, nao pagamento',()=>{
 assert.equal(check({registration:{id:'reg_one',email:'outro@example.com'}}).code,'REGISTRATION_EMAIL_MISMATCH');
});
test('Stripe nao confirmado nao autoriza associacao',()=>{
 for(const k of ['serverVerified','invoicePaid','subscriptionActive']){
  assert.equal(check({paidStripe:{...example.paidStripe,[k]:false}}).code,'PAYMENT_NOT_VERIFIED');
 }
});
test('planos e indices devem ser aprovados antes da vinculacao',()=>{
 assert.equal(check({plansApproved:false}).code,'PLAN_MAPPING_NOT_APPROVED');
 assert.equal(check({uniqueDatabaseConstraints:false}).code,'UNIQUENESS_NOT_READY');
});
test('nao substitui Stripe Customer nem assinatura existentes',()=>{
 assert.equal(check({existingUser:{...example.existingUser,stripeCustomerId:'cus_other'}}).code,'USER_CUSTOMER_CONFLICT');
 assert.equal(check({existingUser:{...example.existingUser,stripeSubscriptionId:'sub_other'}}).code,'USER_SUBSCRIPTION_CONFLICT');
});
test('nao vincula assinatura ou customer de outra conta',()=>{
 assert.equal(check({customerOwner:'user_other'}).code,'CUSTOMER_OWNED_BY_OTHER');
 assert.equal(check({subscriptionOwner:'user_other'}).code,'SUBSCRIPTION_OWNED_BY_OTHER');
});
test('segunda assinatura ativa exige revisao',()=>{
 assert.equal(check({anotherActiveSubscription:true}).code,'OTHER_ACTIVE_SUBSCRIPTION_REVIEW');
});
test('claim ja conciliado nao gera credito repetido',()=>{
 const r=check({previousClaim:{userId:'user_ok',subscriptionId:'sub_one',status:'RECONCILED'}});
 assert.equal(r.code,'ALREADY_RECONCILED_NO_CREDIT');assert.equal(r.creditsGranted,0);
});
test('claim de outro usuario fica bloqueado',()=>{
 assert.equal(check({previousClaim:{userId:'user_other',subscriptionId:'sub_one',status:'RECONCILED'}}).code,'CLAIM_OWNER_CONFLICT');
});
test('transacao exige autorizacao e atomicidade posterior',()=>{
 const r=check();assert.equal(r.needsHumanAuthorization,true);
 assert.equal(r.requiredSteps.at(-1),'commit_or_rollback_atomically');
 assert.equal(r.productionWrites,0);
});
