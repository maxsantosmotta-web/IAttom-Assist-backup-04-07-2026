/**
 * Isolated auth gateway for commercial landing.
 * Verifies Clerk session JWT signatures against the PUBLIC production JWKS.
 * NO Clerk secret, NO database, NO activation, NO credit changes.
 *
 * IMPORTANT: JWT signature alone does NOT check revocation nor whether the
 * Clerk user's PRIMARY EMAIL is verified. Never use this as a paid entitlement.
 */
import {createPublicKey,verify as verifySignature,constants} from 'node:crypto';
export const CLERK_ISSUER='https://clerk.iattomassist.com.br';
export const CLERK_JWKS_URL=CLERK_ISSUER+'/.well-known/jwks.json';
const TRUSTED_AZP=Object.freeze([
 'https://iattomassist.com.br',
 'https://www.iattomassist.com.br',
 'https://workspaceiattom-assist-production.up.railway.app',
 'https://landing-comercial-preview-preview.up.railway.app'
]);
const failure=(reason)=>Object.freeze({ok:false,code:reason,
  authenticatedForEntitlements:false,emailVerified:false,paymentConfirmed:false,
  accountActivated:false,creditsGranted:0,productionWrites:0});
const good=(claims)=>Object.freeze({ok:true,code:'CLERK_JWT_SIGNATURE_VERIFIED',
  clerkUserId:claims.sub,sessionId:claims.sid,expiresAt:claims.exp,
  signatureVerified:true,revocationNotChecked:true,emailVerified:false,
  authenticatedForEntitlements:false,paymentConfirmed:false,
  accountActivated:false,creditsGranted:0,productionWrites:0});
const b64=x=>{
 if(typeof x!=='string'||!x||!/^[a-zA-Z0-9_-]+$/.test(x))throw Error('invalid base64url');
 const bytes=Buffer.from(x,'base64url');
 if(bytes.toString('base64url')!==x)throw Error('noncanonical base64url');
 return bytes;
};
const decodeJson=x=>JSON.parse(b64(x).toString('utf8'));
function validJwk(k){
 return k&&k.kty==='RSA'&&k.use==='sig'&&k.alg==='RS256'&&
   typeof k.kid==='string'&&k.kid.length>3&&k.kid.length<256&&
   typeof k.n==='string'&&k.n.length>100&&
   k.e==='AQAB';
}
const JWKS_CACHE_TTL_MS=10*60*1000;
let cache=null;
export async function fetchProductionClerkJwks({fetcher=fetch,clock=()=>Date.now(),
  bypassCache=false}={}){
 const useCache=fetcher===fetch;
 if(useCache&&!bypassCache&&cache&&clock()<cache.expires)return cache.keys;
 const response=await fetcher(CLERK_JWKS_URL,{
  method:'GET',redirect:'error',
  headers:{Accept:'application/json'},
  signal:AbortSignal.timeout(7000)
 });
 if(response?.status!==200||
   !response.headers?.get('content-type')?.toLowerCase().includes('application/json'))
  throw Error('JWKS_OFFICIAL_UNAVAILABLE');
 const len=response.headers.get('content-length');
 if(len!==null&&(!/^\d+$/.test(len)||Number(len)>32768))
  throw Error('JWKS_TOO_LARGE');
 const reader=response.body?.getReader();
 if(!reader)throw Error('JWKS_NO_BODY');
 let size=0;const chunks=[];
 for(;;){
  const {done,value}=await reader.read();
  if(done)break;
  size+=value.length;
  if(size>32768){await reader.cancel();throw Error('JWKS_TOO_LARGE')}
  chunks.push(value);
 }
 const payload=JSON.parse(Buffer.concat(chunks.map(c=>Buffer.from(c))).toString('utf8'));
 if(!Array.isArray(payload?.keys)||payload.keys.length<1||payload.keys.length>20||
    payload.keys.some(k=>!validJwk(k))||
    new Set(payload.keys.map(k=>k.kid)).size!==payload.keys.length)
  throw Error('JWKS_OFFICIAL_INVALID');
 if(useCache)cache={keys:payload.keys,expires:clock()+JWKS_CACHE_TTL_MS};
 return payload.keys;
}
export async function checkPublicClerkJwks(){
 try{
  const keys=await fetchProductionClerkJwks();
  return {ok:true,code:'OFFICIAL_CLERK_PUBLIC_KEYS_REACHABLE',
   issuer:CLERK_ISSUER,keyCount:keys.length,
   verificationAvailable:true,
   emailVerified:false,subscriptionLinked:false,
   accountActivated:false,creditsGranted:0};
 }catch{
  return {ok:false,code:'OFFICIAL_CLERK_PUBLIC_KEYS_UNAVAILABLE',
   verificationAvailable:false,emailVerified:false,
   accountActivated:false,creditsGranted:0};
 }
}
export async function verifyProductionClerkJwt(token,{getKeys=fetchProductionClerkJwks,
 clock=()=>Date.now()}={}){
 if(typeof token!=='string'||token.length<120||token.length>12000||
   token.includes(' '))return failure('JWT_MISSING_OR_INVALID');
 const parts=token.split('.');
 if(parts.length!==3||parts.some(s=>!s))return failure('JWT_MALFORMED');
 let header,claims,signature;
 try{
  if(parts[0].length>4096||parts[1].length>9000)return failure('JWT_TOO_LARGE');
  header=decodeJson(parts[0]);claims=decodeJson(parts[1]);signature=b64(parts[2]);
  if(!header||Array.isArray(header)||header.alg!=='RS256'||header.typ!=='JWT'||
     typeof header.kid!=='string'||!header.kid||
     'jku' in header||'jwk' in header||'x5u' in header||
     !claims||Array.isArray(claims))
    return failure('JWT_HEADER_OR_PAYLOAD_REJECTED');
 }catch{return failure('JWT_DECODE_FAILED')}
 try{
  const keys=await getKeys();
  const key=keys.find(k=>k.kid===header.kid);
  if(!key||!validJwk(key))return failure('JWT_KEY_NOT_TRUSTED');
  const pub=createPublicKey({key,format:'jwk'});
  const passed=verifySignature('RSA-SHA256',
   Buffer.from(parts[0]+'.'+parts[1]),{
    key:pub,padding:constants.RSA_PKCS1_PADDING
   },signature);
  if(!passed)return failure('JWT_SIGNATURE_INVALID');
 }catch{return failure('JWKS_VERIFICATION_FAILED')}
 const ts=Math.floor(clock()/1000),skew=20;
 if(claims.iss!==CLERK_ISSUER||
    typeof claims.sub!=='string'||!/^user_[A-Za-z0-9]{5,128}$/.test(claims.sub)||
    typeof claims.sid!=='string'||!/^sess_[A-Za-z0-9]{5,128}$/.test(claims.sid)||
    !Number.isSafeInteger(claims.iat)||claims.iat>ts+skew||
    !Number.isSafeInteger(claims.exp)||claims.exp<=ts-skew||
    claims.exp<=claims.iat||claims.exp>ts+86400||
    (claims.nbf!==undefined&&
     (!Number.isSafeInteger(claims.nbf)||claims.nbf>ts+skew))||
    !TRUSTED_AZP.includes(claims.azp))
  return failure('JWT_CLAIMS_NOT_TRUSTED');
 return good(claims);
}
