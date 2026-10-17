// Stub unicamente para testes Node locais. Não é carregado pelo app publicado.
const originalFetch=globalThis.fetch;
const priceAmounts={price_FAKEstart1:6900,price_FAKEpremium1:15900,price_FAKEpro1:29900};
let serial=0;
globalThis.fetch=async (url,options={})=>{
 const address=String(url);
 if(!address.startsWith('https://api.stripe.com/v1/'))return originalFetch(url,options);
 const path=new URL(address).pathname;
 const body=new URLSearchParams(options.body||'');
 let result,code=200;
 if(path.startsWith('/v1/prices/')){
  const id=path.split('/').pop();
  if(!Object.hasOwn(priceAmounts,id)){code=404;result={error:{message:'test price unknown'}}}
  else result={id,livemode:false,active:true,currency:'brl',
    unit_amount:priceAmounts[id],type:'recurring',
    recurring:{interval:'month',interval_count:1}};
 } else if(path==='/v1/customers'){
  const email=body.get('email');
  result={id:'cus_virtual_'+Buffer.from(email).toString('hex').slice(0,16),
    livemode:false,email};
 } else if(path==='/v1/checkout/sessions'){
  const priceId=body.get('line_items[0][price]');
  const customerId=body.get('customer');
  const id='cs_test_virtual_'+(++serial);
  if(!Object.hasOwn(priceAmounts,priceId)||!customerId){code=400;result={error:{message:'invalid virtual checkout'}}}
  else result={id,livemode:false,url:'https://checkout.stripe.com/c/pay/'+id};
 } else {code=404;result={error:{message:'stub endpoint not implemented'}}}
 return new Response(JSON.stringify(result),{status:code,headers:{'Content-Type':'application/json'}});
};
