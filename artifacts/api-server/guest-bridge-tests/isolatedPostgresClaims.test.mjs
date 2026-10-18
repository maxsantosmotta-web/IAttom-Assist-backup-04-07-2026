import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const schema=readFileSync(new URL('./ISOLATED_POSTGRES_TEST_SCHEMA.sql',import.meta.url),'utf8');
const prices={
 START:['price_1TunJ2AYtu5nLhAZPd1Ai0hD','pro',200],
 PREMIUM:['price_1TunQhAYtu5nLhAZu5QXWW31','business',500],
 PRO:['price_1TunTDAYtu5nLhAZDfzTn8Cm','agency',1000]
};
const account='user_joao123',email='joao@example.com';
const reg='123e4567-e89b-42d3-a456-426614174000';
const session='cs_live_safe001',sub='sub_safe001',customer='cus_safe001';
async function fresh(fn,durable=false){
 const dir=mkdtempSync(join(tmpdir(),'iattom-local-postgres-'));
 let db=new PGlite(durable?join(dir,'db'):undefined);
 try{
  await db.exec(schema);
  return await fn({db,reopen:async()=>{
   await db.close();db=new PGlite(join(dir,'db'));return db;
  }});
 }finally{try{await db.close()}catch{}rmSync(dir,{recursive:true,force:true})}
}
async function addAccount(db,id=account,mail=email){
 await db.query('INSERT INTO guest_test_users(clerk_id,verified_primary_email) VALUES($1,$2)',[id,mail]);
}
async function recordPaid(db,{id=session,subscription=sub,cust=customer,plan='PREMIUM',verified=true}={}){
 if(verified!==true)return 'PAYMENT_PROOF_MISSING';
 const [price,internal,credits]=prices[plan];
 const r=await db.query('INSERT INTO guest_test_paid_purchases (session_id,subscription_id,customer_id,registration_id,price_id,plan,internal_plan,promised_general_credits,server_paid_verified) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true) ON CONFLICT DO NOTHING RETURNING session_id',
 [id,subscription,cust,reg,price,plan,internal,credits]);
 if(r.rows.length)return 'PAID_SAVED';
 const old=await db.query('SELECT * FROM guest_test_paid_purchases WHERE session_id=$1 OR subscription_id=$2',[id,subscription]);
 if(old.rows.length===1&&old.rows[0].session_id===id&&old.rows[0].subscription_id===subscription&&old.rows[0].customer_id===cust)return 'ALREADY_SAVED';
 return 'PAYMENT_OWNERSHIP_CONFLICT';
}
async function link(db,{id=session,clerk=account,clerkMail=email,registeredEmail=email}={}){
 if(clerkMail.trim().toLowerCase()!==registeredEmail.trim().toLowerCase())return 'VERIFIED_EMAIL_MISMATCH';
 const u=await db.query('SELECT * FROM guest_test_users WHERE clerk_id=$1',[clerk]);
 if(u.rows.length!==1||u.rows[0].verified_primary_email!==clerkMail.toLowerCase())return 'INVALID_CLERK_OWNER';
 const p=await db.query('SELECT * FROM guest_test_paid_purchases WHERE session_id=$1',[id]);
 if(!p.rows.length)return 'PAID_PURCHASE_NOT_FOUND';
 if(p.rows[0].clerk_id&&p.rows[0].clerk_id!==clerk)return 'PURCHASE_OWNERSHIP_CONFLICT';
 if(u.rows[0].plan!=='free'&&!p.rows[0].clerk_id){
  await db.query("UPDATE guest_test_paid_purchases SET state='MANUAL_REVIEW' WHERE session_id=$1",[id]);
  return 'DUPLICATE_PAID_REQUIRES_REVIEW';
 }
 if(p.rows[0].state==='MANUAL_REVIEW')return 'MANUAL_REVIEW';
 const linked=await db.query("UPDATE guest_test_paid_purchases SET clerk_id=$2,state='READY' WHERE session_id=$1 AND state='PAID_UNLINKED' AND clerk_id IS NULL RETURNING session_id",[id,clerk]);
 return linked.rows.length?'READY':'ALREADY_LINKED';
}
async function grant(db,{id=session,clerk=account,start=1790000000,end=1792592000,crash=false}={}){
 await db.exec('BEGIN');
 try{
  const p=await db.query('SELECT * FROM guest_test_paid_purchases WHERE session_id=$1 FOR UPDATE',[id]);
  const rec=p.rows[0];
  if(!rec||rec.clerk_id!==clerk||!['READY','COMPLETED'].includes(rec.state))throw Error('OWNER_NOT_VERIFIED');
  const key=['subscription',rec.subscription_id,rec.price_id,start,end,rec.internal_plan,'general'].join(':');
  const g=await db.query("INSERT INTO guest_test_general_grants(grant_key,session_id,subscription_id,clerk_id,price_id,period_start,period_end,general_credits,balance_type) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'general') ON CONFLICT DO NOTHING RETURNING grant_key",
  [key,rec.session_id,rec.subscription_id,clerk,rec.price_id,start,end,rec.promised_general_credits]);
  if(g.rows.length){
   await db.query('UPDATE guest_test_users SET general_credits=general_credits+$2 WHERE clerk_id=$1',[clerk,rec.promised_general_credits]);
  }else{
   const previous=await db.query("SELECT * FROM guest_test_general_grants WHERE subscription_id=$1 AND price_id=$2 AND period_start=$3 AND period_end=$4 AND balance_type='general'",[rec.subscription_id,rec.price_id,start,end]);
   if(previous.rows.length!==1||previous.rows[0].grant_key!==key||previous.rows[0].clerk_id!==clerk||previous.rows[0].general_credits!==rec.promised_general_credits)throw Error('GRANT_CONFLICT');
  }
  if(crash)throw Error('SIMULATED_CRASH');
  await db.query('UPDATE guest_test_users SET plan=$2 WHERE clerk_id=$1',[clerk,rec.internal_plan]);
  await db.query("UPDATE guest_test_paid_purchases SET state='COMPLETED' WHERE session_id=$1",[id]);
  await db.exec('COMMIT');
  return g.rows.length?'CREDITED':'ALREADY_CREDITED';
 }catch(e){await db.exec('ROLLBACK');return e.message}
}
async function stats(db){
 const u=await db.query('SELECT plan,general_credits FROM guest_test_users WHERE clerk_id=$1',[account]);
 const g=await db.query('SELECT count(*)::integer AS count FROM guest_test_general_grants');
 return {plan:u.rows[0]?.plan,credits:u.rows[0]?.general_credits,grants:g.rows[0].count};
}
test('three approved general-credit quotas exactly once',async()=>{
 for(const plan of Object.keys(prices))await fresh(async({db})=>{
  await addAccount(db);
  assert.equal(await recordPaid(db,{plan}),'PAID_SAVED');
  assert.equal(await link(db),'READY');
  assert.equal(await grant(db),'CREDITED');
  assert.equal(await grant(db),'ALREADY_CREDITED');
  assert.deepEqual(await stats(db),{plan:prices[plan][1],credits:prices[plan][2],grants:1});
 });
});
test('ten duplicate deliveries never duplicate general credits',()=>fresh(async({db})=>{
 await addAccount(db);await recordPaid(db);await link(db);
 const result=[];for(let i=0;i<10;i++)result.push(await grant(db));
 assert.equal(result.filter(x=>x==='CREDITED').length,1);
 assert.equal(result.filter(x=>x==='ALREADY_CREDITED').length,9);
 assert.equal((await stats(db)).credits,500);
}));
test('payer email may differ from registered/Clerk email',()=>fresh(async({db})=>{
 await addAccount(db);await recordPaid(db);
 assert.equal(await link(db,{registeredEmail:'joao@example.com',clerkMail:'joao@example.com'}),'READY');
 assert.equal(await grant(db),'CREDITED');
}));
test('different Clerk account cannot steal a paid purchase',()=>fresh(async({db})=>{
 await addAccount(db);await addAccount(db,'user_maria123','maria@example.com');
 await recordPaid(db);await link(db);
 assert.equal(await link(db,{clerk:'user_maria123',clerkMail:'maria@example.com',registeredEmail:'maria@example.com'}),'PURCHASE_OWNERSHIP_CONFLICT');
 assert.equal(await grant(db,{clerk:'user_maria123'}),'OWNER_NOT_VERIFIED');
 assert.equal((await stats(db)).grants,0);
}));
test('mismatched Clerk email leaves PAID_UNLINKED instead of losing purchase',()=>fresh(async({db})=>{
 await addAccount(db);await recordPaid(db);
 assert.equal(await link(db,{clerkMail:'joao@example.com',registeredEmail:'outra@example.com'}),'VERIFIED_EMAIL_MISMATCH');
 const q=await db.query('SELECT state,clerk_id FROM guest_test_paid_purchases');
 assert.equal(q.rows[0].state,'PAID_UNLINKED');assert.equal(q.rows[0].clerk_id,null);
}));
test('a second paid purchase for same registration stays for review, not lost',()=>fresh(async({db})=>{
 await addAccount(db);await recordPaid(db);await link(db);await grant(db);
 assert.equal(await recordPaid(db,{id:'cs_live_safe002',subscription:'sub_safe002',cust:'cus_safe002'}),'PAID_SAVED');
 assert.equal(await link(db,{id:'cs_live_safe002'}),'DUPLICATE_PAID_REQUIRES_REVIEW');
 const r=await db.query("SELECT state FROM guest_test_paid_purchases WHERE session_id='cs_live_safe002'");
 assert.equal(r.rows[0].state,'MANUAL_REVIEW');assert.equal((await stats(db)).credits,500);
}));
test('unique session and subscription keys reject conflicting ownership',()=>fresh(async({db})=>{
 await recordPaid(db);
 assert.equal(await recordPaid(db),'ALREADY_SAVED');
 assert.equal(await recordPaid(db,{id:'cs_live_safe003',subscription:sub,cust:'cus_other'}),'PAYMENT_OWNERSHIP_CONFLICT');
 assert.equal((await db.query('SELECT count(*)::integer AS n FROM guest_test_paid_purchases')).rows[0].n,1);
}));
test('a crash after ledger insertion rolls back both credit and grant',()=>fresh(async({db})=>{
 await addAccount(db);await recordPaid(db);await link(db);
 assert.equal(await grant(db,{crash:true}),'SIMULATED_CRASH');
 assert.deepEqual(await stats(db),{plan:'free',credits:0,grants:0});
 assert.equal(await grant(db),'CREDITED');
 assert.equal((await stats(db)).credits,500);
}));
test('disk-backed PostgreSQL reopens with PAID_UNLINKED purchase intact',()=>fresh(async({db,reopen})=>{
 await addAccount(db);await recordPaid(db);
 const restarted=await reopen();
 const r=await restarted.query('SELECT state,clerk_id FROM guest_test_paid_purchases');
 assert.equal(r.rows[0].state,'PAID_UNLINKED');assert.equal(r.rows[0].clerk_id,null);
},true));
test('unverified receipt and unknown session cannot create grants',()=>fresh(async({db})=>{
 await addAccount(db);
 assert.equal(await recordPaid(db,{verified:false}),'PAYMENT_PROOF_MISSING');
 assert.equal(await link(db),'PAID_PURCHASE_NOT_FOUND');
 assert.equal(await grant(db),'OWNER_NOT_VERIFIED');
 assert.equal((await stats(db)).credits,0);
}));
