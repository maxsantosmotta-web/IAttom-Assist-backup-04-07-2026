import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import net from 'node:net';
import {HandoffState,planPendingHandoffs,simulateVerifiedClerkHandoff} from '../pending-handoff.mjs';
const email='comprador-virtual@example.com',registrationId='11111111-1111-4111-8111-111111111111';
const session=(n='1')=>({sessionId:'cs_test_guest_'+n,customerId:'cus_guest',
 registrationId,email,plan:'PREMIUM',amount:15900});
const paid=(n='1')=>({status:'PAID_TEST',sessionId:session(n).sessionId,registrationId,plan:'PREMIUM'});
test('prepara pendência com acesso bloqueado',()=>{
 const list=planPendingHandoffs(paid(),session(),new Map());
 assert.equal(list.length,1);assert.equal(list[0].pendingStatus,HandoffState.WAITING);
 assert.equal(list[0].accountActivated,false);assert.equal(list[0].amountBRL,15900);
 assert.equal(list[0].clerkUserId,null);
});
test('evento não pago e repetição não criam pendência duplicada',()=>{
 assert.deepEqual(planPendingHandoffs({...paid(),status:'FAILED_TEST'},session(),new Map()),[]);
 const first=planPendingHandoffs(paid(),session(),new Map())[0];
 assert.deepEqual(planPendingHandoffs(paid(),session(),new Map([[first.sessionId,first]])),[]);
});
test('segundo pagamento do mesmo comprador marca os dois para revisão',()=>{
 const first=planPendingHandoffs(paid(),session(),new Map())[0];
 const updates=planPendingHandoffs(paid('2'),session('2'),new Map([[first.sessionId,first]]));
 assert.equal(updates.length,2);
 assert(updates.every(x=>x.pendingStatus===HandoffState.REVIEW&&x.accountActivated===false));
 assert.equal(simulateVerifiedClerkHandoff(updates[0],{registrationEmail:email}).eligible,false);
});
test('Customer da pendência é o recebido por webhook, não o e-mail pre-cadastrado',()=>{
 const guest={...session(),customerId:null};
 const rows=planPendingHandoffs({...paid(),customerId:'cus_payment'},guest,new Map());
 assert.equal(rows.length,1);assert.equal(rows[0].customerId,'cus_payment');
 assert.equal(rows[0].accountActivated,false);
 assert.throws(()=>planPendingHandoffs({...paid(),customerId:'cus_other'},session(),new Map()));
});
test('simulação Clerk exige email verificado, assinatura ativa, pagamento e ausência de conflito',()=>{
 const pending=planPendingHandoffs(paid(),session(),new Map())[0];
 const evidence={registrationEmail:email,verifiedClerkEmail:email,clerkEmailVerified:true,
 clerkUserId:'user_virtual',paidFromVerifiedStripeWebhook:true,subscriptionActive:true,
 purchasedSubscriptionId:'sub_virtual',existingStripeCustomerId:null,existingActiveSubscriptionId:null};
 const ok=simulateVerifiedClerkHandoff(pending,evidence);
 assert.equal(ok.eligible,true);assert.equal(ok.accountActivated,false);
 assert.equal(ok.requiresOfficialBackendReconciliation,true);
 for(const change of [{verifiedClerkEmail:'wrong@example.com'},{clerkEmailVerified:false},
 {paidFromVerifiedStripeWebhook:false},{subscriptionActive:false},
 {existingStripeCustomerId:'cus_other'},{existingActiveSubscriptionId:'sub_other'}])
   assert.equal(simulateVerifiedClerkHandoff(pending,{...evidence,...change}).eligible,false);
});
test('endpoint local grava pendência, sobrevive a restart e bloqueia duplicidade',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'iattom-handoff-'));
 const listener=net.createServer();
 const port=await new Promise((ok,fail)=>{listener.once('error',fail);listener.listen(0,'127.0.0.1',()=>{const p=listener.address().port;listener.close(()=>ok(p))})});
 const secret='whsec_virtual_replay';
 const sessionsFile=join(dir,'stripe-test-sessions.jsonl'),pendingFile=join(dir,'stripe-test-handoffs.jsonl');
 writeFileSync(join(dir,'pre-registrations.jsonl'),JSON.stringify({id:registrationId,email})+'\n');
 writeFileSync(sessionsFile,JSON.stringify(session())+'\n');
 const env={...process.env,PORT:String(port),PRE_SIGNUP_DATA_DIR:dir,
 STRIPE_TEST_CHECKOUT_ENABLED:'true',STRIPE_TEST_SECRET_KEY:'sk_test_FAKE_ONLY_LOCAL',
 STRIPE_TEST_PRICE_START:'price_FAKEstart1',STRIPE_TEST_PRICE_PREMIUM:'price_FAKEpremium1',
 STRIPE_TEST_PRICE_PRO:'price_FAKEpro1',STRIPE_TEST_WEBHOOK_ENABLED:'true',
 STRIPE_TEST_WEBHOOK_SECRET:secret};
 let child;
 const base='http://127.0.0.1:'+port;
 async function start(){
   child=spawn(process.execPath,[resolve(import.meta.dirname,'../server.mjs')],{env,stdio:'ignore'});
   for(let i=0;i<60;i++){try{if((await fetch(base+'/healthz')).ok)return}catch{}await new Promise(r=>setTimeout(r,80))}
   throw Error('Local server not started');
 }
 async function stop(){
   if(!child||child.exitCode!==null)return;
   const instance=child;await new Promise(done=>{instance.once('exit',done);instance.kill('SIGTERM');setTimeout(done,1500)});
   child=null;
 }
 async function send(n,eid){
   const body=JSON.stringify({id:eid,type:'checkout.session.completed',livemode:false,
    data:{object:{id:session(n).sessionId,livemode:false,mode:'subscription',customer:'cus_guest',
    client_reference_id:registrationId,currency:'brl',amount_total:15900,payment_status:'paid',
    customer_details:{email},metadata:{plan:'PREMIUM',pre_registration_id:registrationId}}}});
   const ts=Math.floor(Date.now()/1000),sig=createHmac('sha256',secret).update(ts+'.'+body).digest('hex');
   const res=await fetch(base+'/api/stripe/test-webhook',{method:'POST',headers:
    {'Content-Type':'application/json','Stripe-Signature':'t='+ts+',v1='+sig},body});
   return {status:res.status,result:await res.json()};
 }
 try{
   await start();
   const r=await send('1','evt_guest_1');assert.equal(r.status,200);
   assert.equal(r.result.accountActivated,false);
   let entries=readFileSync(pendingFile,'utf8').trim().split('\n').map(JSON.parse);
   assert.equal(entries.length,1);assert.equal(entries[0].pendingStatus,HandoffState.WAITING);
   await stop();await start();
   const repeat=await send('1','evt_guest_1');assert.equal(repeat.result.duplicate,true);
   entries=readFileSync(pendingFile,'utf8').trim().split('\n').map(JSON.parse);
   assert.equal(entries.length,1);
   writeFileSync(sessionsFile,JSON.stringify(session())+'\n'+JSON.stringify(session('2'))+'\n');
   await stop();await start();
   assert.equal((await send('2','evt_guest_2')).status,200);
   entries=readFileSync(pendingFile,'utf8').trim().split('\n').map(JSON.parse);
   const latest=new Map(entries.map(x=>[x.sessionId,x]));
   assert.equal(latest.size,2);
   assert([...latest.values()].every(x=>x.pendingStatus===HandoffState.REVIEW&&!x.accountActivated));
 }finally{await stop();rmSync(dir,{recursive:true,force:true})}
});
