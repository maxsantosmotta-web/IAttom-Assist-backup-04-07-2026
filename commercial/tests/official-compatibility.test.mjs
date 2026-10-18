import test from 'node:test';
import assert from 'node:assert/strict';
import {COMMERCIAL_PREVIEW_PLANS,getCommercialPreviewPlan,assessGuestCheckoutHandoff} from '../official-compatibility.mjs';
const example={
 commercialPlan:'PREMIUM',registrationEmail:' Usuario@Example.com ',verifiedClerkEmail:'usuario@example.com',
 clerkEmailVerified:true,clerkUserId:'user_virtual',stripeCustomerId:'cus_virtual',
 paidFromVerifiedStripeWebhook:true,subscriptionActive:true,
 existingStripeCustomerId:null,existingActiveSubscriptionId:null,
 purchasedSubscriptionId:'sub_virtual',previewOnly:true
};
test('confere preços comerciais e mapa legado provisório',()=>{
 assert.deepEqual(Object.values(COMMERCIAL_PREVIEW_PLANS).map(x=>x.amountBRL),[6900,15900,29900]);
 assert.deepEqual(Object.values(COMMERCIAL_PREVIEW_PLANS).map(x=>x.legacyPlanKey),['pro','business','agency']);
 assert.equal(getCommercialPreviewPlan('invalid'),null);
});
test('pagamento virtual válido aguarda vínculo oficial, sem ativar acesso',()=>{
 const r=assessGuestCheckoutHandoff(example);
 assert.equal(r.eligible,true);assert.equal(r.accountActivated,false);
 assert.equal(r.legacyPlanKey,'business');
 assert.equal(r.status,'PENDING_OFFICIAL_RECONCILIATION');
 assert.equal(r.requiresOfficialBackendReconciliation,true);
});
test('vínculo inseguro por email divergente ou não verificado bloqueado',()=>{
 for(const change of [{clerkEmailVerified:false},{verifiedClerkEmail:'outro@example.com'},
   {clerkUserId:''},{registrationEmail:''}])
   assert.equal(assessGuestCheckoutHandoff({...example,...change}).eligible,false);
});
test('sem pagamento confirmado, assinatura ativa ou ambiente isolado não prossegue',()=>{
 for(const change of [{paidFromVerifiedStripeWebhook:false},{subscriptionActive:false},{previewOnly:false}])
  assert.equal(assessGuestCheckoutHandoff({...example,...change}).eligible,false);
});
test('associação duplicada ou customer estranho não prossegue',()=>{
 for(const change of [{existingStripeCustomerId:'cus_outro'},
  {existingActiveSubscriptionId:'sub_outra'},{stripeCustomerId:''},{purchasedSubscriptionId:''}])
  assert.equal(assessGuestCheckoutHandoff({...example,...change}).eligible,false);
});
