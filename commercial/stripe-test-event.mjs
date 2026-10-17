import { createHmac, timingSafeEqual } from 'node:crypto';

const eventTypes = Object.freeze({
  'checkout.session.completed': 'completed',
  'checkout.session.async_payment_succeeded': 'success',
  'checkout.session.async_payment_failed': 'failed',
  'checkout.session.expired': 'expired'
});
const monthlyBRL=Object.freeze({START:6900,PREMIUM:15900,PRO:29900});

export function verifyStripeTestSignature(raw,header,secret,now=Date.now()){
  if(!Buffer.isBuffer(raw)||!raw.length||typeof header!=='string'||header.length>1024||
    typeof secret!=='string'||!secret.startsWith('whsec_'))return false;
  const parts=header.split(',').map(p=>p.trim());
  const timeParts=parts.filter(p=>/^t=\d{9,12}$/.test(p));
  if(timeParts.length!==1)return false;
  const timestamp=Number(timeParts[0].slice(2));
  if(!Number.isSafeInteger(timestamp)||Math.abs(now-timestamp*1000)>300000)return false;
  const candidates=parts.filter(p=>/^v1=[0-9a-f]{64}$/i.test(p)).map(p=>p.slice(3));
  if(!candidates.length)return false;
  const digest=createHmac('sha256',secret).update(String(timestamp)+'.').update(raw).digest();
  return candidates.some(hex=>{
    const received=Buffer.from(hex,'hex');
    return received.length===digest.length&&timingSafeEqual(received,digest);
  });
}

export function evaluateStripeTestEvent(event,{sessions,registrations,seenEvents,statusBySession}){
  if(!event||event.livemode!==false||typeof event.id!=='string'||!event.id.startsWith('evt_'))
    throw Error('Evento inválido ou fora do modo de teste');
  const eventType=eventTypes[event.type];
  if(!eventType)return {ignored:true};
  if(seenEvents.has(event.id))return {duplicate:true};
  const checkout=event.data?.object;
  const saved=checkout?.id?sessions.get(checkout.id):null;
  const email=saved?registrations.get(saved.registrationId):null;
  if(!saved||!email||checkout.livemode!==false||
     checkout.mode!=='subscription'||checkout.client_reference_id!==saved.registrationId||
     checkout.customer!==saved.customerId||checkout.currency!=='brl'||
     checkout.amount_total!==monthlyBRL[saved.plan]||saved.amount!==monthlyBRL[saved.plan]||
     checkout.metadata?.plan!==saved.plan||
     checkout.metadata?.pre_registration_id!==saved.registrationId||
     email!==saved.email)throw Error('Checkout sem vínculo válido ao pré-cadastro');
  const checkoutEmail=checkout.customer_details?.email||checkout.customer_email;
  if(checkoutEmail&&checkoutEmail.toLowerCase().trim()!==email)
    throw Error('E-mail do checkout diverge do pré-cadastro');
  if(!['paid','unpaid','no_payment_required'].includes(checkout.payment_status))
    throw Error('Estado de pagamento inválido');
  if(eventType==='success'&&checkout.payment_status!=='paid')
    throw Error('Sucesso sem pagamento confirmado');
  let status='PENDING_TEST';
  if(eventType==='success'||(eventType==='completed'&&checkout.payment_status==='paid'))status='PAID_TEST';
  if(eventType==='failed')status='FAILED_TEST';
  if(eventType==='expired')status='EXPIRED_TEST';
  if(statusBySession.get(saved.sessionId)==='PAID_TEST')status='PAID_TEST';
  return {eventId:event.id,sessionId:saved.sessionId,registrationId:saved.registrationId,
    plan:saved.plan,status,duplicate:false,accountActivated:false};
}

export function mayAssociateVerifiedClerk({paymentStatus,registrationEmail,clerkEmail,clerkEmailVerified}){
  return paymentStatus==='PAID_TEST'&&clerkEmailVerified===true&&
    typeof registrationEmail==='string'&&typeof clerkEmail==='string'&&
    registrationEmail.toLowerCase().trim()===clerkEmail.toLowerCase().trim();
}
