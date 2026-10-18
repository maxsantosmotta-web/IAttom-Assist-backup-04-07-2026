import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {OFFICIAL_MONTHLY_PLANS} from '../official-checkout-contract.mjs';
import {LIVE_OFFICIAL_CATALOG_URL} from '../official-live-catalog.mjs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
const cases=[
 ['START','price_1TunJ2AYtu5nLhAZPd1Ai0hD',6900,'pro'],
 ['PREMIUM','price_1TunQhAYtu5nLhAZu5QXWW31',15900,'business'],
 ['PRO','price_1TunTDAYtu5nLhAZDfzTn8Cm',29900,'agency']
];
test('POST dos três botões usa os Price IDs oficiais e impede cobrança real',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'iattom-cta-official-'));
 const port=await new Promise((resolvePort,reject)=>{
  const netServer=net.createServer();netServer.on('error',reject);
  netServer.listen(0,'127.0.0.1',()=>{
   const p=netServer.address().port;netServer.close(()=>resolvePort(p));
  });
 });
 const environment={...process.env,PRE_SIGNUP_DATA_DIR:dir,PORT:String(port),
  STRIPE_LIVE_SECRET_KEY:'sk_live_FAKE_NAO_USAR',
  OFFICIAL_CHECKOUT_RELEASED:'true',OFFICIAL_PAYMENT_AUTHORIZED:'true'};
 // Only the virtual subprocess receives an in-memory catalog response.
 // This test never reads live Stripe or triggers a payment.
 const fakeCatalog=Object.entries(OFFICIAL_MONTHLY_PLANS).map(([name,p],i)=>({
  planKey:p.planKey,name,priceId:p.priceId,amount:p.amountCents,
  currency:'brl',interval:'month',credits:[200,500,1000][i]
 }));
 const preloader=join(dir,'fake-official-catalog.mjs');
 writeFileSync(preloader,[
  'const originalFetch=globalThis.fetch;',
  'globalThis.fetch=(url,opts)=>{',
  'if(String(url)==='+JSON.stringify(LIVE_OFFICIAL_CATALOG_URL)+')',
  ' return Promise.resolve(new Response('+JSON.stringify(JSON.stringify(fakeCatalog))+',{status:200,headers:{"content-type":"application/json"}}));',
  'return originalFetch(url,opts);',
  '};'
 ].join('\\n').replaceAll('\\n','\n'));
 const child=spawn(process.execPath,['--import',preloader,resolve(import.meta.dirname,'../server.mjs')],{
  env:environment,stdio:['ignore','pipe','pipe']});
 let stderr='';child.stderr.on('data',x=>stderr+=String(x));
 try{
  const origin='http://127.0.0.1:'+port;
  let listening=false;
  for(let attempt=0;attempt<60;attempt++){
   try{if((await fetch(origin+'/healthz')).ok){listening=true;break}}catch{}
   await new Promise(resolve=>setTimeout(resolve,80));
  }
  assert(listening,'Servidor falhou: '+stderr);
  const homepage=await(await fetch(origin+'/')).text();
  assert.match(homepage,/\/api\/stripe\/official-checkout/);
  assert.match(homepage,/\/api\/stripe\/test-checkout/);
  const register=await fetch(origin+'/api/pre-register',{method:'POST',
   headers:{'Content-Type':'application/json',Origin:origin},
   body:JSON.stringify({email:'comprador-virtual@example.com'})});
  assert.equal(register.status,200);
  const {registrationId}=await register.json();
  const endpoint=origin+'/api/stripe/official-checkout';
  for(const [plan,priceId,amountCents,internalPlanKey] of cases){
   const response=await fetch(endpoint,{method:'POST',
    headers:{'Content-Type':'application/json',Origin:origin},
    body:JSON.stringify({plan,registrationId,priceId:'price_INJETADO',
      email:'falso@example.com',amountCents:50})});
   assert.equal(response.status,200,'Plano '+plan+' falhou: '+stderr);
   const payload=await response.json();
   assert.equal(payload.priceId,priceId);
   assert.equal(payload.amountCents,amountCents);
   assert.equal(payload.internalPlanKey,internalPlanKey);
   assert.equal(payload.prepared,true);
   assert.equal(payload.checkoutEnabled,false);
   assert.equal(payload.realPayments,false);
   assert.equal(payload.url,undefined);
   assert.equal(payload.accountActivated,false);
   assert.equal(payload.creditsGranted,0);
  }
  const invalid=await fetch(endpoint,{method:'POST',
   headers:{'Content-Type':'application/json',Origin:origin},
   body:JSON.stringify({plan:'AGENCY',registrationId})});
  assert.equal(invalid.status,400);
  const unregistered=await fetch(endpoint,{method:'POST',
   headers:{'Content-Type':'application/json',Origin:origin},
   body:JSON.stringify({plan:'START',registrationId:'123e4567-e89b-42d3-a456-426614174999'})});
  assert.equal(unregistered.status,403);
  const external=await fetch(endpoint,{method:'POST',
   headers:{'Content-Type':'application/json',Origin:'https://origem-estranha.example'},
   body:JSON.stringify({plan:'PRO',registrationId})});
  assert.equal(external.status,403);
  assert.equal((await fetch(endpoint)).status,405);
  const testStatus=await(await fetch(origin+'/api/stripe/test-status')).json();
  assert.equal(testStatus.ready,false);assert.equal(testStatus.realPayments,false);
  assert.equal(readFileSync(join(dir,'pre-registrations.jsonl'),'utf8').trim().split('\n').length,1);
 }finally{
  child.kill('SIGTERM');
  rmSync(dir,{recursive:true,force:true});
 }
});
