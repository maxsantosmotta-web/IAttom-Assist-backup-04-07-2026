import {getCommercialPreviewPlan,assessGuestCheckoutHandoff} from './official-compatibility.mjs';
export const HandoffState=Object.freeze({WAITING:'WAITING_VERIFIED_CLERK',REVIEW:'REVIEW_DUPLICATE_PURCHASE'});
export function planPendingHandoffs(decision,session,existing,now=new Date().toISOString()){
 if(decision?.status!=='PAID_TEST')return [];
 if(!(existing instanceof Map)||!session||typeof session.sessionId!=='string'||
   !session.sessionId.startsWith('cs_test_')||!session.customerId?.startsWith('cus_')||
   !session.registrationId||!session.email||decision.sessionId!==session.sessionId||
   decision.registrationId!==session.registrationId||decision.plan!==session.plan)
   throw Error('Sessão incompatível com pagamento');
 const plan=getCommercialPreviewPlan(session.plan);
 if(!plan||plan.amountBRL!==session.amount)throw Error('Valor do plano incompatível');
 if(existing.has(session.sessionId))return [];
 const collisions=[...existing.values()].filter(r=>r.registrationId===session.registrationId||r.customerId===session.customerId);
 const duplicate=collisions.length>0;
 const changed=collisions.filter(r=>r.pendingStatus!==HandoffState.REVIEW)
   .map(r=>({...r,pendingStatus:HandoffState.REVIEW,reviewReason:'MULTIPLE_PURCHASES',
     updatedAt:now,accountActivated:false}));
 changed.push({sessionId:session.sessionId,registrationId:session.registrationId,
   customerId:session.customerId,plan:session.plan,legacyPlanKey:plan.legacyPlanKey,
   amountBRL:plan.amountBRL,paymentStatus:'PAID_TEST',
   pendingStatus:duplicate?HandoffState.REVIEW:HandoffState.WAITING,
   reviewReason:duplicate?'MULTIPLE_PURCHASES':null,
   clerkUserId:null,accountActivated:false,requiresOfficialBackendReconciliation:true,
   createdAt:now,updatedAt:now});
 return changed;
}
export function simulateVerifiedClerkHandoff(row,{registrationEmail,...evidence}={}){
 const blocked=(reason)=>({eligible:false,reason,accountActivated:false,requiresOfficialBackendReconciliation:true});
 if(!row||row.pendingStatus!==HandoffState.WAITING)return blocked('Revisão de duplicidade ou pendência ausente');
 if(typeof registrationEmail!=='string'||!registrationEmail.trim()||!row.registrationId)
   return blocked('Pré-cadastro não identificado');
 return assessGuestCheckoutHandoff({
   commercialPlan:row.plan,registrationEmail,
   verifiedClerkEmail:evidence.verifiedClerkEmail,
   clerkEmailVerified:evidence.clerkEmailVerified,
   clerkUserId:evidence.clerkUserId,
   stripeCustomerId:row.customerId,
   existingStripeCustomerId:evidence.existingStripeCustomerId,
   paidFromVerifiedStripeWebhook:row.paymentStatus==='PAID_TEST'&&evidence.paidFromVerifiedStripeWebhook===true,
   subscriptionActive:evidence.subscriptionActive,
   existingActiveSubscriptionId:evidence.existingActiveSubscriptionId,
   purchasedSubscriptionId:evidence.purchasedSubscriptionId,
   previewOnly:true
 });
}
