import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';

test('jornada ponta a ponta virtual: pré-cadastro → plano → Stripe fictício → webhook',async()=>{
 const data=mkdtempSync(join(tmpdir(),'iattom-checkout-'));
 const port=await new Promise((yes,no)=>{
  const srv=net.createServer();srv.on('error',no);
  srv.listen(0,'127.0.0.1',()=>{const p=srv.address().port;srv.close(()=>yes(p));});
 });
 const stub=resolve(import.meta.dirname,'stripe-api-stub.mjs');
 const secret='whsec_simulacao_nunca_usada_em_conta_real';
 const env={...process.env,
  PORT:String(port),PRE_SIGNUP_DATA_DIR:data,
  NODE_OPTIONS:'--import='+stub,
  STRIPE_TEST_CHECKOUT_ENABLED:'true',
  STRIPE_TEST_SECRET_KEY:'sk_test_FAKE_NAO_UTILIZAR_NA_STRIPE',
  STRIPE_TEST_PRICE_START:'price_FAKEstart1',
  STRIPE_TEST_PRICE_PREMIUM:'price_FAKEpremium1',
  STRIPE_TEST_PRICE_PRO:'price_FAKEpro1',
  STRIPE_TEST_WEBHOOK_ENABLED:'true',
  STRIPE_TEST_WEBHOOK_SECRET:secret
 };
 const child=spawn(process.execPath,[resolve(import.meta.dirname,'../server.mjs')],{env,stdio:['ignore','pipe','pipe']});
 let errors='';child.stderr.on('data',x=>{errors+=x.toString()});
 try{
  const base='http://127.0.0.1:'+port;
  let healthy=false;
  for(let i=0;i<50;i++){
   try{if((await fetch(base+'/healthz')).ok){healthy=true;break}}catch{}
   await new Promise(r=>setTimeout(r,100));
  }
  assert(healthy,'Servidor simulado não iniciou: '+errors);
  const status=await (await fetch(base+'/api/stripe/test-status')).json();
  assert.equal(status.ready,true);
  assert.equal(status.realPayments,false);
  const email='jornada-virtual@example.com';
  const pre=await fetch(base+'/api/pre-register',{method:'POST',
    headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});
  assert.equal(pre.status,200);
  const reg=await pre.json();assert.equal(reg.email,email);
  for(const plan of ['START','PREMIUM','PRO']){
   const response=await fetch(base+'/api/stripe/test-checkout',{method:'POST',
    headers:{'Content-Type':'application/json',
      Origin:'https://landing-comercial-preview-preview.up.railway.app'},
    body:JSON.stringify({registrationId:reg.registrationId,plan,email:'email-adulterado@example.com'})});
   assert.equal(response.status,200,'Checkout '+plan+' falhou: '+errors);
   const result=await response.json();
   assert.equal(result.mode,'test');assert.equal(result.plan,plan);
   assert.match(result.url,/^https:\/\/checkout\.stripe\.com\/c\/pay\/cs_test_/);
  }
  const tracked=readFileSync(join(data,'stripe-test-sessions.jsonl'),'utf8')
   .trim().split('\n').map(JSON.parse);
  assert.equal(tracked.length,3);
  assert(tracked.every(row=>row.registrationId===reg.registrationId&&row.email===email));
  assert.deepEqual(tracked.map(row=>row.amount),[6900,15900,29900]);
  const premium=tracked[1];
  const event={id:'evt_virtual_e2e',type:'checkout.session.completed',livemode:false,
    data:{object:{id:premium.sessionId,livemode:false,mode:'subscription',
      client_reference_id:premium.registrationId,customer:premium.customerId,
      amount_total:premium.amount,currency:'brl',payment_status:'paid',
      customer_details:{email},metadata:{plan:'PREMIUM',
        pre_registration_id:premium.registrationId}}}};
  const raw=JSON.stringify(event),timestamp=Math.floor(Date.now()/1000);
  const header='t='+timestamp+',v1='+
    createHmac('sha256',secret).update(String(timestamp)+'.'+raw).digest('hex');
  const webhook=await fetch(base+'/api/stripe/test-webhook',{method:'POST',
    headers:{'Stripe-Signature':header,'Content-Type':'application/json'},body:raw});
  assert.equal(webhook.status,200);
  assert.equal((await webhook.json()).accountActivated,false);
  const persisted=JSON.parse(readFileSync(join(data,'stripe-test-events.jsonl'),'utf8').trim());
  assert.equal(persisted.status,'PAID_TEST');
  assert.equal(persisted.accountActivated,false);
  // Bloqueia tentativa de inventar id de pré-cadastro.
  const rogue=await fetch(base+'/api/stripe/test-checkout',{method:'POST',
    headers:{'Content-Type':'application/json',Origin:'https://landing-comercial-preview-preview.up.railway.app'},
    body:JSON.stringify({registrationId:'00000000-0000-4000-8000-000000000001',plan:'PRO'})});
  assert.equal(rogue.status,403);
 }finally{
  child.kill('SIGTERM');rmSync(data,{recursive:true,force:true});
 }
});
