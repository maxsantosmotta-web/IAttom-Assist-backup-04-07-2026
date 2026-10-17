/**
 * Compatibilidade PROVISÓRIA baseada em consulta somente-leitura do legado.
 * Não acessa Stripe/Clerk/DB nem pode ativar conta.
 */
export const COMMERCIAL_PREVIEW_PLANS=Object.freeze({
 START:Object.freeze({amountBRL:6900,legacyPlanKey:'pro'}),
 PREMIUM:Object.freeze({amountBRL:15900,legacyPlanKey:'business'}),
 PRO:Object.freeze({amountBRL:29900,legacyPlanKey:'agency'})
});
export function getCommercialPreviewPlan(value){
 if(typeof value!=='string'||!Object.hasOwn(COMMERCIAL_PREVIEW_PLANS,value))return null;
 return COMMERCIAL_PREVIEW_PLANS[value];
}
const norm=x=>typeof x==='string'?x.trim().toLowerCase():'';
export function assessGuestCheckoutHandoff({
 commercialPlan,registrationEmail,verifiedClerkEmail,clerkEmailVerified,
 clerkUserId,stripeCustomerId,existingStripeCustomerId,
 paidFromVerifiedStripeWebhook,subscriptionActive,
 existingActiveSubscriptionId,purchasedSubscriptionId,
 previewOnly=true
}={}){
 const blocked=(reason)=>({eligible:false,reason,accountActivated:false,requiresOfficialBackendReconciliation:true});
 const plan=getCommercialPreviewPlan(commercialPlan);
 if(!plan)return blocked('Plano desconhecido');
 if(previewOnly!==true)return blocked('Ambiente não isolado');
 if(paidFromVerifiedStripeWebhook!==true||subscriptionActive!==true)return blocked('Pagamento ou assinatura não confirmados');
 if(clerkEmailVerified!==true||!clerkUserId||!norm(registrationEmail)||norm(registrationEmail)!==norm(verifiedClerkEmail))
  return blocked('E-mail Clerk não confirmado');
 if(typeof stripeCustomerId!=='string'||!stripeCustomerId.startsWith('cus_'))
  return blocked('Cliente Stripe não identificado');
 if(existingStripeCustomerId&&existingStripeCustomerId!==stripeCustomerId)
  return blocked('Cliente Stripe já vinculado a outro identificador');
 if(existingActiveSubscriptionId&&existingActiveSubscriptionId!==purchasedSubscriptionId)
  return blocked('Outra assinatura ativa, revisar duplicidade');
 if(!purchasedSubscriptionId||!purchasedSubscriptionId.startsWith('sub_'))
  return blocked('Assinatura não identificada');
 return {eligible:true,status:'PENDING_OFFICIAL_RECONCILIATION',
  commercialPlan,legacyPlanKey:plan.legacyPlanKey,
  accountActivated:false,requiresOfficialBackendReconciliation:true};
}
