import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createSign,randomUUID} from 'node:crypto';
import {CLERK_ISSUER,CLERK_JWKS_URL,fetchProductionClerkJwks,
 verifyProductionClerkJwt} from '../clerk-isolated-verifier.mjs';
const now=1771000000,kid='unit-test-isolated-kid';
const pair=generateKeyPairSync('rsa',{modulusLength:2048,publicExponent:65537});
const publicJwk={...pair.publicKey.export({format:'jwk'}),kid,alg:'RS256',use:'sig'};
const base={iss:CLERK_ISSUER,sub:'user_123456789',sid:'sess_123456789',azp:'https://iattomassist.com.br',iat:now-20,exp:now+300,nbf:now-20,email:'attacker@fake.com',email_verified:true};
const signature=(text,privateKey=pair.privateKey)=>{
 const sign=createSign('RSA-SHA256');sign.update(text);sign.end();
 return sign.sign(privateKey).toString('base64url');
};
const token=(payload=base,header={alg:'RS256',typ:'JWT',kid})=>{
 const value=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
 const data=value(header)+'.'+value(payload);
 return data+'.'+signature(data);
};
const options={getKeys:async()=>[publicJwk],clock:()=>now*1000};
test('valid RS256 signature from pinned issuer verifies only session, no email or entitlement',async()=>{
 const r=await verifyProductionClerkJwt(token(),options);
 assert.equal(r.ok,true);assert.equal(r.clerkUserId,base.sub);
 assert.equal(r.emailVerified,false);assert.equal(r.paymentConfirmed,false);
 assert.equal(r.accountActivated,false);assert.equal(r.creditsGranted,0);
 assert.equal(r.authenticatedForEntitlements,false);
});
test('tampered payload fails signature before trusting any user details',async()=>{
 const tok=token();
 const chunks=tok.split('.');
 chunks[1]=Buffer.from(JSON.stringify({...base,sub:'user_attacker_123456'})).toString('base64url');
 assert.equal((await verifyProductionClerkJwt(chunks.join('.'),options)).code,'JWT_SIGNATURE_INVALID');
});
test('unsigned/none/HMAC headers are rejected',async()=>{
 for(const alg of ['none','HS256','RS512','ES256']){
  assert.equal((await verifyProductionClerkJwt(token(base,{alg,typ:'JWT',kid}),options)).code,
    'JWT_HEADER_OR_PAYLOAD_REJECTED');
 }
});
test('a JWT signed with untrusted key fails even if kid matches',async()=>{
 const foreign=generateKeyPairSync('rsa',{modulusLength:2048});
 const data=token();const bits=data.split('.');
 const other=bits[0]+'.'+bits[1]+'.'+signature(bits[0]+'.'+bits[1],foreign.privateKey);
 assert.equal((await verifyProductionClerkJwt(other,options)).code,'JWT_SIGNATURE_INVALID');
});
test('issuer, origin, user id and session id must match exact constraints',async()=>{
 for(const change of [{iss:'https://evil.tld'},{azp:'https://evil.tld'},
  {sub:'admin'},{sid:'sess!'},{azp:'https://iattomassist.com.br.evil.tld'}]){
  const r=await verifyProductionClerkJwt(token({...base,...change}),options);
  assert.equal(r.code,'JWT_CLAIMS_NOT_TRUSTED');
 }
});
test('expired, future, implausible or not-yet-valid tokens rejected',async()=>{
 for(const change of [{exp:now-100},{iat:now+100},
  {nbf:now+100},{exp:now+172800},{exp:now-50,iat:now+100}]){
  const r=await verifyProductionClerkJwt(token({...base,...change}),options);
  assert.equal(r.code,'JWT_CLAIMS_NOT_TRUSTED');
 }
});
test('JWT cannot select remote key source from x5u, jku or jwk',async()=>{
 for(const bad of [{jku:'https://evil.tld/key'}, {x5u:'https://evil.tld/key'},
  {jwk:publicJwk}]){
  const r=await verifyProductionClerkJwt(token(base,{alg:'RS256',typ:'JWT',kid,...bad}),options);
  assert.equal(r.code,'JWT_HEADER_OR_PAYLOAD_REJECTED');
 }
});
test('signed JWT without known kid fails closed',async()=>{
 assert.equal((await verifyProductionClerkJwt(token(base,{alg:'RS256',typ:'JWT',kid:'unknown'}),options)).code,'JWT_KEY_NOT_TRUSTED');
});
test('live JWKS request strictly targets official Clerk issuer',async()=>{
 const req=async(url,opt)=>{
  assert.equal(url,CLERK_JWKS_URL);
  assert.equal(opt.method,'GET');assert.equal(opt.redirect,'error');
  return new Response(JSON.stringify({keys:[publicJwk]}),{
   status:200,headers:{'content-type':'application/json'}});
 };
 const keys=await fetchProductionClerkJwks({fetcher:req});
 assert.equal(keys.length,1);assert.equal(keys[0].kid,kid);
});
test('invalid, duplicate, huge or unavailable key lists fail safely',async()=>{
 for(const payload of [{keys:[]},{keys:[publicJwk,publicJwk]},{keys:[{...publicJwk,kty:'EC'}]}]){
  await assert.rejects(()=>fetchProductionClerkJwks({fetcher:async()=>new Response(JSON.stringify(payload),{
   status:200,headers:{'content-type':'application/json'}})}));
 }
 await assert.rejects(()=>fetchProductionClerkJwks({fetcher:async()=>{throw Error('network down')}}));
});
test('raw secret or user-controlled domain can never select a key server',async()=>{
 const r=await verifyProductionClerkJwt('some.fake.token',{
  getKeys:async()=>{throw Error('should not query keys for malformed jwt')}});
 assert.equal(r.ok,false);
});
