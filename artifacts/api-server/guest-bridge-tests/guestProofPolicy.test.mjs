import test from "node:test";
import assert from "node:assert/strict";
import { GUEST_MONTHLY, signGuestRegistration, validateGuestRegistrationProof } from "../src/lib/guestCommercialProof.ts";
import { assessGuestCommercialPurchase } from "../src/lib/guestCommercialPolicy.ts";
const signingKey="0123456789abcdef".repeat(4);
const registrationId="123e4567-e89b-42d3-a456-426614174000";
const created=1792280000;
function input(plan="PREMIUM",registeredEmail="joao@example.com"){
 const spec=GUEST_MONTHLY[plan];
 const metadata={commercial_source:"landing",plan,planKey:spec.planKey,
  pre_registration_id:registrationId,pre_registration_issued_at:String(created)};
 metadata.pre_registration_proof=signGuestRegistration({
  registrationId,plan,verifiedRegistrationEmail:registeredEmail,
  issuedAt:created,sharedSigningKey:signingKey
 });
 return {session:{id:"cs_live_sample123",livemode:true,status:"complete",paymentStatus:"paid",
  mode:"subscription",customer:"cus_sample",subscriptionId:"sub_sample",
  created,currency:"brl",amountTotal:spec.cents,
  clientReferenceId:registrationId,metadata},
 subscription:{id:"sub_sample",livemode:true,status:"active",customer:"cus_sample",
  metadata:{commercial_source:"landing",plan,planKey:spec.planKey,pre_registration_id:registrationId},
  itemPrices:[{id:spec.priceId,currency:"brl",amount:spec.cents,interval:"month"}],
  invoiceId:"in_sample"},
 invoice:{id:"in_sample",livemode:true,status:"paid",paid:true,customer:"cus_sample",
  subscriptionId:"sub_sample",currency:"brl",amountPaid:spec.cents},
 user:{clerkId:"user_joao123",email:"joao@example.com",role:"user",plan:"free",
  stripeCustomerId:null,stripeSubscriptionId:null},
 clerkId:"user_joao123",verifiedClerkEmail:"joao@example.com",
 sharedSigningKey:signingKey,nowSeconds:created+60,existingCustomerOwner:null,
 existingSubscriptionOwner:null,activeSubscriptionsForCustomer:["sub_sample"]};
}
const check=spec=>assessGuestCommercialPurchase(spec);
test("all three official plans match paid live subscription and general credits",()=>{
 for(const name of ["START","PREMIUM","PRO"]){
  const out=check(input(name));assert.equal(out.ok,true,name);
  assert.equal(out.priceId,GUEST_MONTHLY[name].priceId);
  assert.equal(out.credits,GUEST_MONTHLY[name].credits);
 }
});
test("payer email unrelated to registration does not block valid owner",()=>{
 const sample=input();sample.session.customerDetails={email:"maria@example.com"};
 assert.equal(check(sample).ok,true);
 assert.equal(JSON.stringify(sample.session.metadata).includes("joao@example.com"),false);
});
test("different verified Clerk primary email cannot claim the order",()=>{
 const result=check({...input(),verifiedClerkEmail:"maria@example.com"});
 assert.equal(result.code,"VERIFIED_CLERK_EMAIL_NOT_MATCHED");
});
test("changed plan, preregistration id or signature fails",()=>{
 for(const change of [{plan:"PRO",planKey:"agency"},
  {pre_registration_id:"123e4567-e89b-42d3-a456-426614174001"},
  {pre_registration_proof:"0".repeat(64)}]){
  const sample=input();sample.session.metadata={...sample.session.metadata,...change};
  assert.equal(check(sample).ok,false);
 }
});
test("not paid, not live or not an active subscription never activates",()=>{
 for(const field of [{status:"open"},{paymentStatus:"unpaid"},
  {livemode:false},{mode:"payment"},{id:"cs_test_attempt"}]){
  const sample=input();Object.assign(sample.session,field);
  assert.equal(check(sample).ok,false);
 }
});
test("amount, Price ID, interval and BRL checks prevent substitution",()=>{
 for(const change of [{id:"price_wrong"},{amount:50},{interval:"year"},{currency:"usd"}]){
  const sample=input();Object.assign(sample.subscription.itemPrices[0],change);
  assert.equal(check(sample).ok,false);
 }
 const sample=input();sample.session.amountTotal=50;assert.equal(check(sample).ok,false);
});
test("invoice paid and matching customer and subscription is mandatory",()=>{
 for(const change of [{paid:false},{status:"open"},{amountPaid:50},
  {subscriptionId:"sub_other"},{customer:"cus_other"},{livemode:false}]){
  const sample=input();Object.assign(sample.invoice,change);
  assert.equal(check(sample).ok,false);
 }
});
test("do not replace an existing user plan or admin",()=>{
 for(const change of [{plan:"agency"},{role:"admin"},
  {stripeCustomerId:"cus_another"}]){
  const sample=input();Object.assign(sample.user,change);
  assert.equal(check(sample).ok,false);
 }
});
test("no cross-account ownership and no duplicate active subscriptions",()=>{
 for(const change of [{existingCustomerOwner:"user_other"},
  {existingSubscriptionOwner:"user_other"},
  {activeSubscriptionsForCustomer:["sub_sample","sub_other"]}]){
  assert.equal(check({...input(),...change}).ok,false);
 }
});
test("signed proof expires and wrong email cannot reuse signature",()=>{
 const sample=input();
 assert.equal(validateGuestRegistrationProof({metadata:sample.session.metadata,
  clerkPrimaryEmail:"outro@example.com",checkoutCreated:created,
  nowSeconds:created+60,sharedSigningKey:signingKey}).ok,false);
 const expired={...sample.session.metadata,pre_registration_issued_at:String(created-86401)};
 assert.equal(validateGuestRegistrationProof({metadata:expired,
  clerkPrimaryEmail:"joao@example.com",checkoutCreated:created,
  nowSeconds:created+60,sharedSigningKey:signingKey}).ok,false);
});
test("case-independent matching of registration and verified Clerk email",()=>{
 const sample=input("START","  JOAO@EXAMPLE.COM ");
 assert.equal(check(sample).ok,true);
});
