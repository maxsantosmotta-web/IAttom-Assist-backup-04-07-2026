/** Explicitly opt-in, server-only, independent checkout/bridge/payment authorisations. */
export function officialReleaseFlags(env = process.env) {
 const approved=env.IATTOM_COMMERCIAL_OPERATOR_APPROVED==='true';
 return Object.freeze({
  officialCheckoutReleased:approved&&env.IATTOM_COMMERCIAL_CHECKOUT_RELEASED==='true',
  bridgeReconciliationReady:approved&&env.IATTOM_COMMERCIAL_BRIDGE_READY==='true',
  authorizedProductionRelease:approved&&env.IATTOM_COMMERCIAL_PAYMENT_AUTHORIZED==='true'
 });
}
export function validateCommercialPublicOrigin(env=process.env) {
 const raw=env.COMMERCIAL_LANDING_PUBLIC_ORIGIN;
 if(typeof raw!=='string'||!/^https:\/\/[A-Za-z0-9.-]+$/.test(raw))return null;
 try{
  const u=new URL(raw);
  if(u.protocol!=='https:'||u.port||u.username||u.password||
     !(u.hostname==='iattomassist.com.br'||u.hostname.endsWith('.iattomassist.com.br')))return null;
  return u.origin;
 }catch{return null}
}
