/** Read-only verified PRIMARY email lookup. No entitlement or mutation. */
export const CLERK_USER_API='https://api.clerk.com/v1/users/';
const deny=code=>({ok:false,code,verifiedEmail:null,accountActivated:false,creditsGranted:0,paymentConfirmed:false});
const norm=x=>typeof x==='string'?x.trim().toLowerCase():'';
const userIdOk=x=>typeof x==='string'&&/^user_[A-Za-z0-9]{5,128}$/.test(x);
export function assessClerkPrimaryEmail(user,userId){
 if(!userIdOk(userId)||!user||Array.isArray(user)||user.id!==userId)return deny('USER_ID_MISMATCH');
 if(user.banned===true||user.locked===true||user.deprovisioned===true||user.deleted===true)return deny('USER_RESTRICTED');
 const primary=user.primary_email_address_id;
 if(typeof primary!=='string'||!Array.isArray(user.email_addresses))return deny('PRIMARY_EMAIL_MISSING');
 const match=user.email_addresses.filter(x=>x?.id===primary);
 if(match.length!==1||match[0].verification?.status!=='verified')return deny('PRIMARY_EMAIL_NOT_VERIFIED');
 const e=norm(match[0].email_address);
 if(e.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e))return deny('PRIMARY_EMAIL_INVALID');
 return {ok:true,code:'PRIMARY_EMAIL_VERIFIED',verifiedEmail:e,accountActivated:false,creditsGranted:0,paymentConfirmed:false};
}
export async function getClerkVerifiedPrimaryEmail({userId,secret,enabled=false,fetcher=fetch}={}){
 if(enabled!==true)return deny('CLERK_READ_DISABLED');
 if(!userIdOk(userId))return deny('INVALID_CLERK_USER_ID');
 if(typeof secret!=='string'||!/^sk_live_[A-Za-z0-9_-]{20,}$/.test(secret))return deny('READ_CREDENTIAL_NOT_CONFIGURED');
 try{
  const r=await fetcher(CLERK_USER_API+encodeURIComponent(userId),{
   method:'GET',redirect:'error',
   headers:{Authorization:'Bearer '+secret,Accept:'application/json'},
   signal:AbortSignal.timeout(7000)});
  if(r?.status!==200||!r.headers?.get('content-type')?.toLowerCase().includes('application/json'))return deny('CLERK_USER_UNAVAILABLE');
  const length=r.headers.get('content-length');
  if(length!==null&&(!/^\d+$/.test(length)||+length>32768))return deny('CLERK_RESPONSE_TOO_LARGE');
  const reader=r.body?.getReader();if(!reader)return deny('CLERK_USER_UNAVAILABLE');
  const parts=[];let n=0;
  for(;;){
   const {done,value}=await reader.read();if(done)break;
   n+=value.byteLength;
   if(n>32768){await reader.cancel();return deny('CLERK_RESPONSE_TOO_LARGE')}
   parts.push(value);
  }
  return assessClerkPrimaryEmail(JSON.parse(Buffer.concat(parts.map(x=>Buffer.from(x))).toString('utf8')),userId);
 }catch{return deny('CLERK_USER_UNAVAILABLE')}
}
export function compareVerifiedEmail(verifiedEmail,registrationEmail){
 const a=norm(verifiedEmail),b=norm(registrationEmail);
 return {ok:!!a&&!!b&&a===b,code:!!a&&!!b&&a===b?'PRIMARY_EMAIL_MATCH':'PRIMARY_EMAIL_MISMATCH',
  paymentConfirmed:false,accountActivated:false,creditsGranted:0};
}
