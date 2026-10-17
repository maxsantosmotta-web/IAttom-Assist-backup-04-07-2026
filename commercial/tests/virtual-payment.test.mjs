import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import net from 'node:net';
import {verifyStripeTestSignature,evaluateStripeTestEvent,mayAssociateVerifiedClerk} from '../stripe-test-event.mjs';

const secret='whsec_somente_para_simulacao_local_sem_stripe';
const id='11111111-1111-4111-8111-111111111111';
const email='comprador-virtual@example.com';
const saved={sessionId:'cs_test_virtual_example',registrationId:id,email,customerId:'cus_virtual',
  plan:'PREMIUM',amount:15900};
const context=()=>({sessions:new Map([[saved.sessionId,saved]]),
  registrations:new Map([[id,email]]),seenEvents:new Set(),statusBySession:new Map()});
let counter=0;
const stripeEvent=(type='checkout.session.completed',changes={})=>({
 id:'evt_virtual_'+(++counter),type,livemode:false,
 data:{object:{id:saved.sessionId,livemode:false,mode:'subscription',
  client_reference_id:id,customer:saved.customerId,amount_total:15900,currency:'brl',
  payment_status:'paid',customer_details:{email},
  metadata:{plan:'PREMIUM',pre_registration_id:id},...changes}}
});
const signature=(raw,t=Math.floor(Date.now()/1000))=>'t='+t+',v1='+
 createHmac('sha256',secret).update(String(t)+'.').update(raw).digest('hex');
test('webhook: assinatura sintética é verificável e não aceita adulteração/atraso',()=>{
 const raw=Buffer.from(JSON.stringify(stripeEvent()));const now=Date.now();
 assert.equal(verifyStripeTestSignature(raw,signature(raw),secret,now),true);
 assert.equal(verifyStripeTestSignature(Buffer.from('fake'),signature(raw),secret,now),false);
 assert.equal(verifyStripeTestSignature(raw,signature(raw,Math.floor(now/1000)-601),secret,now),false);
 assert.equal(verifyStripeTestSignature(raw,signature(raw),'whsec_incorreto',now),false);
});
test('webhook: aprovado não ativa conta e duplicidade é detectada',()=>{
 const ctx=context(),evt=stripeEvent(),result=evaluateStripeTestEvent(evt,ctx);
 assert.equal(result.status,'PAID_TEST');assert.equal(result.accountActivated,false);
 ctx.seenEvents.add(evt.id);
 assert.equal(evaluateStripeTestEvent(evt,ctx).duplicate,true);
});
test('webhook: pendente, recusado e expirado ficam bloqueados',()=>{
 assert.equal(evaluateStripeTestEvent(stripeEvent('checkout.session.completed',{payment_status:'unpaid'}),context()).status,'PENDING_TEST');
 assert.equal(evaluateStripeTestEvent(stripeEvent('checkout.session.async_payment_failed',{payment_status:'unpaid'}),context()).status,'FAILED_TEST');
 assert.equal(evaluateStripeTestEvent(stripeEvent('checkout.session.expired',{payment_status:'unpaid'}),context()).status,'EXPIRED_TEST');
});
test('webhook: evento atrasado não rebaixa aprovação',()=>{
 const ctx=context();ctx.statusBySession.set(saved.sessionId,'PAID_TEST');
 assert.equal(evaluateStripeTestEvent(stripeEvent('checkout.session.expired'),ctx).status,'PAID_TEST');
});
test('webhook: rejeita evento real ou adulteração de cliente, email, preço e plano',()=>{
 const ctx=context();
 assert.throws(()=>evaluateStripeTestEvent({...stripeEvent(),livemode:true},ctx));
 for(const change of [{id:'cs_test_diferente'},{customer:'cus_estranho'},
  {customer_details:{email:'outro@example.com'}},{amount_total:29900},
  {metadata:{plan:'PRO',pre_registration_id:id}}]){
  assert.throws(()=>evaluateStripeTestEvent(stripeEvent('checkout.session.completed',change),ctx));
 }
});
test('Clerk virtual: exige mesmo email verificado e pagamento',()=>{
 const v={paymentStatus:'PAID_TEST',registrationEmail:email,clerkEmail:email,clerkEmailVerified:true};
 assert.equal(mayAssociateVerifiedClerk(v),true);
 assert.equal(mayAssociateVerifiedClerk({...v,clerkEmailVerified:false}),false);
 assert.equal(mayAssociateVerifiedClerk({...v,clerkEmail:'outro@example.com'}),false);
 assert.equal(mayAssociateVerifiedClerk({...v,paymentStatus:'FAILED_TEST'}),false);
});
test('HTTP local: webhook assinado e idempotência no volume simulado',async()=>{
 const data=mkdtempSync(join(tmpdir(),'iattom-sim-'));
 const port=await new Promise((resolvePort,reject)=>{
  const n=net.createServer();
  n.on('error',reject);
  n.listen(0,'127.0.0.1',()=>{
    const p=n.address().port;n.close(()=>resolvePort(p));
  });
 });
 writeFileSync(join(data,'pre-registrations.jsonl'),JSON.stringify({id,email})+'\n');
 writeFileSync(join(data,'stripe-test-sessions.jsonl'),JSON.stringify(saved)+'\n');
 const env={...process.env,PORT:String(port),PRE_SIGNUP_DATA_DIR:data,
   STRIPE_TEST_CHECKOUT_ENABLED:'true',
   STRIPE_TEST_SECRET_KEY:'sk_test_FAKE_LOCAL_SIMULATION_NEVER_USED_IN_API',
   STRIPE_TEST_PRICE_START:'price_FAKEstart1',
   STRIPE_TEST_PRICE_PREMIUM:'price_FAKEpremium1',
   STRIPE_TEST_PRICE_PRO:'price_FAKEpro1',
   STRIPE_TEST_WEBHOOK_ENABLED:'true',STRIPE_TEST_WEBHOOK_SECRET:secret};
 const child=spawn(process.execPath,[resolve(import.meta.dirname,'../server.mjs')],{env,stdio:['ignore','pipe','pipe']});
 let stderr='';
 child.stderr.on('data',chunk=>{stderr+=chunk.toString();});
 try{
  const origin='http://127.0.0.1:'+port;
  let healthy=false;
  for(let i=0;i<60;i++){
   try{const response=await fetch(origin+'/healthz');if(response.ok){healthy=true;break;}}catch{}
   await new Promise(r=>setTimeout(r,100));
  }
  assert.equal(healthy,true,'servidor local iniciou: '+stderr);
  const send=async(evt,valid=true)=>{
   const raw=Buffer.from(JSON.stringify(evt));
   const response=await fetch(origin+'/api/stripe/test-webhook',{
    method:'POST',
    headers:{'Content-Type':'application/json','Stripe-Signature':valid?signature(raw):'t=1000000000,v1='+('0'.repeat(64))},
    body:raw
   });
   return {code:response.status,data:await response.json()};
  };
  const evt=stripeEvent();
  const success=await send(evt);assert.equal(success.code,200);assert.equal(success.data.received,true);
  assert.equal(success.data.accountActivated,false);
  const again=await send(evt);assert.equal(again.code,200);assert.equal(again.data.duplicate,true);
  const invalid=await send(stripeEvent(),false);assert.equal(invalid.code,400);
  const changed=await send(stripeEvent('checkout.session.completed',{amount_total:29900}));assert.equal(changed.code,400);
  const expired=await send(stripeEvent('checkout.session.expired',{payment_status:'unpaid'}));assert.equal(expired.code,200);
  const rows=readFileSync(join(data,'stripe-test-events.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(rows.length,2);
  assert.equal(rows[0].status,'PAID_TEST');
  assert.equal(rows[1].status,'PAID_TEST');
  assert(rows.every(r=>r.accountActivated===false));
 }finally{
  child.kill('SIGTERM');
  rmSync(data,{recursive:true,force:true});
 }
});
