import test from 'node:test';
import assert from 'node:assert/strict';
import {assessClerkPrimaryEmail,getClerkVerifiedPrimaryEmail,compareVerifiedEmail,CLERK_USER_API} from '../clerk-primary-email-readonly.mjs';
const uid='user_123456789',secret='sk_live_'+('A'.repeat(32));
const u=(patch={})=>({id:uid,primary_email_address_id:'em_primary',
 email_addresses:[{id:'em_primary',email_address:'Comprador@Example.com',verification:{status:'verified'}},
 {id:'secondary',email_address:'outro@example.com',verification:{status:'verified'}}],
 banned:false,locked:false,deprovisioned:false,...patch});
test('verified PRIMARY e-mail accepted and normalized',()=>{
 const r=assessClerkPrimaryEmail(u(),uid);assert.equal(r.verifiedEmail,'comprador@example.com');
 assert.equal(r.creditsGranted,0);assert.equal(r.accountActivated,false);
});
test('secondary verified e-mail does not satisfy primary match',()=>{
 const r=compareVerifiedEmail(assessClerkPrimaryEmail(u(),uid).verifiedEmail,'outro@example.com');
 assert.equal(r.ok,false);
});
test('same verified primary email matches case-insensitively',()=>{
 assert.equal(compareVerifiedEmail('Comprador@Example.com','comprador@example.COM').ok,true);
});
test('unverified, banned, mismatched and missing primary rejected',()=>{
 for(const change of [{banned:true},{locked:true},{deprovisioned:true},
  {id:'user_other123'},{primary_email_address_id:'unavailable'},
  {email_addresses:[{id:'em_primary',email_address:'a@b.com',verification:{status:'unverified'}}]}])
 assert.equal(assessClerkPrimaryEmail(u(change),uid).ok,false);
});
test('disabled preview returns before reading any Clerk account',async()=>{
 let calls=0;
 const r=await getClerkVerifiedPrimaryEmail({userId:uid,secret,
  fetcher:async()=>{calls++;throw Error('do not call')}});
 assert.equal(r.code,'CLERK_READ_DISABLED');assert.equal(calls,0);
});
test('unconfigured isolated secret makes zero network calls',async()=>{
 let calls=0;
 const r=await getClerkVerifiedPrimaryEmail({userId:uid,enabled:true,
  fetcher:async()=>{calls++}});
 assert.equal(r.code,'READ_CREDENTIAL_NOT_CONFIGURED');assert.equal(calls,0);
});
test('read-only GET to pinned Clerk BAPI path with signer-derived user ID',async()=>{
 const r=await getClerkVerifiedPrimaryEmail({userId:uid,secret,enabled:true,
  fetcher:async(url,params)=>{
   assert.equal(url,CLERK_USER_API+uid);assert.equal(params.method,'GET');
   assert.equal(params.redirect,'error');assert.equal(params.headers.Authorization,'Bearer '+secret);
   assert.equal(Object.hasOwn(params,'body'),false);
   return new Response(JSON.stringify(u()),{status:200,headers:{'content-type':'application/json'}});
  }});
 assert.equal(r.ok,true);assert.equal(r.verifiedEmail,'comprador@example.com');
});
test('Clerk error and unexpected content fail closed',async()=>{
 for(const response of [
  new Response('Forbidden',{status:403}),
  new Response('HTML',{status:200,headers:{'content-type':'text/html'}}),
  new Response(JSON.stringify(u()),{status:200,headers:{'content-type':'application/json','content-length':'999999'}})
 ]){
  const r=await getClerkVerifiedPrimaryEmail({userId:uid,secret,enabled:true,
   fetcher:async()=>response});assert.equal(r.ok,false);
 }
});
