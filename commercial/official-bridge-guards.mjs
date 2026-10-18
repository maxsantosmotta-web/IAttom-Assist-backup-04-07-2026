/* IAttom Assist: guardas puros e isolados para desenho da ponte. SEM I/O. */
const email=x=>typeof x==='string'?x.trim().toLowerCase():'';
const result=(safe,code,extras={})=>({safe,code,accountActivated:false,creditsGranted:0,productionWrites:0,...extras});
export function auditUserSync({identity,requestedEmail,recordByEmail,recordByClerk}={}){
 if(!identity?.serverVerified||!identity?.emailVerified||!identity.userId?.startsWith('user_')||!email(identity.email))
  return result(false,'UNVERIFIED_CLERK');
 if(requestedEmail!==undefined&&email(requestedEmail)!==email(identity.email))
  return result(false,'CLIENT_EMAIL_MISMATCH');
 if(recordByEmail&&recordByEmail.clerkId!==identity.userId)
  return result(false,'ACCOUNT_REASSIGNMENT_BLOCKED');
 if(recordByClerk&&recordByClerk.clerkId!==identity.userId)
  return result(false,'CLERK_ID_CONFLICT');
 if(recordByClerk&&email(recordByClerk.email)!==email(identity.email))
  return result(false,'CLERK_EMAIL_CONFLICT');
 return result(true,'CLERK_IDENTITY_ACCEPTABLE',{verifiedEmail:email(identity.email),noAutomaticRoleChange:true});
}
export function auditDeletion({deletedSubscriptionId,customerId,activeUserSubscriptionId,
 authoritativeStripe=false,remainingSubscriptions}={}){
 if(!authoritativeStripe||!Array.isArray(remainingSubscriptions))return result(false,'STRIPE_STATUS_NOT_VERIFIED');
 if(!deletedSubscriptionId?.startsWith('sub_')||!customerId?.startsWith('cus_'))return result(false,'INVALID_DELETE_EVENT');
 if(remainingSubscriptions.some(x=>x.customerId!==customerId))return result(false,'FOREIGN_CUSTOMER_IN_SNAPSHOT');
 const active=remainingSubscriptions.filter(x=>x.id!==deletedSubscriptionId&&x.status==='active'&&x.paidInvoice===true);
 if(activeUserSubscriptionId&&activeUserSubscriptionId!==deletedSubscriptionId){
  const current=active.find(x=>x.id===activeUserSubscriptionId);
  return current?result(true,'KEEP_EXISTING_PAID_SUBSCRIPTION',{subscriptionId:current.id}):result(false,'CURRENT_SUBSCRIPTION_REVIEW');
 }
 if(active.length)return result(true,'KEEP_REMAINING_PAID_SUBSCRIPTION',{subscriptionId:active[0].id});
 if(remainingSubscriptions.some(x=>x.id!==deletedSubscriptionId&&['active','trialing','past_due'].includes(x.status)))
  return result(false,'REMAINING_SUBSCRIPTION_UNRESOLVED');
 return result(true,'REVIEW_DOWNGRADE_ONLY',{mustReconcileWithoutAutomaticCreditReset:true});
}
export function auditClaim({bridgeEnabled=false,identity,registration,paidStripe,existingUser,
 customerOwner,subscriptionOwner,previousClaim,anotherActiveSubscription=false,
 plansApproved=false,uniqueDatabaseConstraints=false}={}){
 if(!bridgeEnabled)return result(false,'FEATURE_DISABLED');
 const auth=auditUserSync({identity,recordByEmail:existingUser,recordByClerk:existingUser});
 if(!auth.safe)return result(false,'IDENTITY_'+auth.code);
 if(!registration?.id||email(registration.email)!==auth.verifiedEmail)
  return result(false,'REGISTRATION_EMAIL_MISMATCH');
 if(!paidStripe?.serverVerified||!paidStripe?.invoicePaid||!paidStripe?.subscriptionActive||
  !paidStripe.customerId?.startsWith('cus_')||!paidStripe.subscriptionId?.startsWith('sub_')||
  !paidStripe.checkoutId?.startsWith('cs_')||paidStripe.registrationId!==registration.id)
  return result(false,'PAYMENT_NOT_VERIFIED');
 if(!plansApproved)return result(false,'PLAN_MAPPING_NOT_APPROVED');
 if(!uniqueDatabaseConstraints)return result(false,'UNIQUENESS_NOT_READY');
 if(existingUser?.stripeCustomerId&&existingUser.stripeCustomerId!==paidStripe.customerId)
  return result(false,'USER_CUSTOMER_CONFLICT');
 if(existingUser?.stripeSubscriptionId&&existingUser.stripeSubscriptionId!==paidStripe.subscriptionId)
  return result(false,'USER_SUBSCRIPTION_CONFLICT');
 if(customerOwner&&customerOwner!==identity.userId)return result(false,'CUSTOMER_OWNED_BY_OTHER');
 if(subscriptionOwner&&subscriptionOwner!==identity.userId)return result(false,'SUBSCRIPTION_OWNED_BY_OTHER');
 if(anotherActiveSubscription)return result(false,'OTHER_ACTIVE_SUBSCRIPTION_REVIEW');
 if(previousClaim){
  if(previousClaim.userId!==identity.userId||previousClaim.subscriptionId!==paidStripe.subscriptionId)
   return result(false,'CLAIM_OWNER_CONFLICT');
  return previousClaim.status==='RECONCILED'
   ?result(true,'ALREADY_RECONCILED_NO_CREDIT',{idempotent:true})
   :result(false,'CLAIM_NEEDS_LOCKED_RETRY');
 }
 return result(true,'SAFE_TO_DESIGN_TRANSACTION',{needsHumanAuthorization:true,
  requiredSteps:['lock_verified_user','reserve_unique_checkout_and_subscription',
   'recheck_stripe_and_other_payment_providers','attach_authorized_subscription',
   'call_existing_canonical_paid_invoice_grant_once','commit_or_rollback_atomically']});
}
