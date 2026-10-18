import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const migration=readFileSync(new URL('../../../lib/db/sql/20261018_commercial_guest_claims.sql',import.meta.url),'utf8');
const old='CREATE TABLE users(clerk_id text PRIMARY KEY,credits integer DEFAULT 0);'+
'CREATE TABLE credits_transactions(id integer PRIMARY KEY,clerk_user_id text,amount integer);'+
"INSERT INTO users(clerk_id,credits) VALUES ('user_original',87);"+
"INSERT INTO credits_transactions(id,clerk_user_id,amount) VALUES(1,'user_original',17);";
const sample={session:'cs_live_1234567',subscription:'sub_original',customer:'cus_payer',
invoice:'in_paid',registration:'123e4567-e89b-42d3-a456-426614174000',
price:'price_1TunQhAYtu5nLhAZu5QXWW31',hmac:'0123456789abcdef'.repeat(4)};
async function fresh(fn){const db=new PGlite();try{await db.exec(old);await fn(db)}finally{await db.close()}}
async function data(db){return {
users:(await db.query('SELECT * FROM users ORDER BY clerk_id')).rows,
ledger:(await db.query('SELECT * FROM credits_transactions ORDER BY id')).rows
}}
async function insert(db,fields={}){
const x={...sample,...fields};
return db.query('INSERT INTO commercial_guest_claims ('+
'checkout_session_id,stripe_subscription_id,stripe_customer_id,stripe_invoice_id,'+
'registration_id,price_id,commercial_plan,checkout_created_at,'+
'pre_registration_issued_at,pre_registration_proof,plan_key,general_credit_amount,'+
'billing_period_start,billing_period_end) VALUES('+
"$1,$2,$3,$4,$5,$6,'PREMIUM',1792000100,1792000000,$7,'business',500,1792000000,1794592000)",
[x.session,x.subscription,x.customer,x.invoice,x.registration,x.price,x.hmac]);
}
test('actual guest PostgreSQL migration installs twice, leaves old user balances alone',()=>fresh(async db=>{
const before=await data(db);
await db.exec(migration);await db.exec(migration);
assert.deepEqual(await data(db),before);
const names=(await db.query("SELECT column_name FROM information_schema.columns WHERE table_name='commercial_guest_claims'")).rows.map(x=>x.column_name);
for(const col of ['checkout_session_id','stripe_subscription_id','stripe_customer_id','registration_id','price_id','pre_registration_proof','clerk_user_id','status','lease_token','lease_expires_at','general_credit_amount','billing_period_start','billing_period_end'])assert.ok(names.includes(col),col);
await insert(db);
const claim=(await db.query('SELECT * FROM commercial_guest_claims')).rows[0];
assert.equal(claim.status,'PAID_UNLINKED');assert.equal(claim.clerk_user_id,null);
assert.deepEqual(await data(db),before);
}));
test('actual guest PostgreSQL migration enforces unique, FK and check constraints',()=>fresh(async db=>{
await db.exec(migration);await insert(db);
await assert.rejects(()=>insert(db,{session:'cs_live_diff123'}));
await assert.rejects(()=>insert(db,{subscription:'sub_different'}));
assert.equal((await db.query('SELECT count(*)::int AS n FROM commercial_guest_claims')).rows[0].n,1);
await assert.rejects(()=>db.query('UPDATE commercial_guest_claims SET general_credit_amount=0'));
await assert.rejects(()=>db.query("UPDATE commercial_guest_claims SET status='FAKE'"));
await assert.rejects(()=>db.query("UPDATE commercial_guest_claims SET clerk_user_id='user_unknown'"));
await assert.rejects(()=>db.query("UPDATE commercial_guest_claims SET status='COMPLETED'"));
await db.query("UPDATE commercial_guest_claims SET clerk_user_id='user_original',status='READY'");
await db.query("UPDATE commercial_guest_claims SET status='COMPLETED'");
assert.equal((await db.query('SELECT status FROM commercial_guest_claims')).rows[0].status,'COMPLETED');
}));
test('migration is additive, with no destructive statements',()=>{
const commands=migration.replace(/--[^\n]*/g,'');
assert.match(commands,/CREATE TABLE IF NOT EXISTS commercial_guest_claims/);
assert.match(commands,/CREATE INDEX IF NOT EXISTS commercial_guest_claims_clerk_idx/);
assert.doesNotMatch(commands,/\b(UPDATE|DELETE|DROP|TRUNCATE|ALTER)\b/i);
});
