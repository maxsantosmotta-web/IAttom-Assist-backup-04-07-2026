import http from 'node:http';
import { readFileSync, appendFileSync, existsSync, mkdirSync, openSync, closeSync, chmodSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = process.env.PRE_SIGNUP_DATA_DIR || '/data';
const FILE = join(DATA_DIR, 'pre-registrations.jsonl');
const records = new Map();
const visitors = new Map();
mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
try { chmodSync(DATA_DIR, 0o700); } catch {}
if (!existsSync(FILE)) { const fd = openSync(FILE, 'a', 0o600); closeSync(fd); }
if (existsSync(FILE)) {
  for (const line of readFileSync(FILE, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try { const record = JSON.parse(line); if (record.email && record.id) records.set(record.email, record.id); } catch {}
  }
}
function send(res, status, obj, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers });
  res.end(JSON.stringify(obj));
}
function throttle(key) {
  const now = Date.now();
  const recent = (visitors.get(key) || []).filter(t => now - t < 3600000);
  recent.push(now); visitors.set(key, recent);
  return recent.length > 20;
}

const MEDIA_HOST = "https://fdb0ddbd-d838-437e-905b-7933427055a4.sandbox.floot.app";
const MEDIA_IMAGES = Object.freeze({"/assets/landing/modulos.png":"/_cdn/static/38fb713c-5196-46a1-8aac-4874691ce194-painel_modulos.png","/assets/landing/buscar.png":"/_cdn/static/738ba327-484c-4ee1-bf55-0050df9efbdb-buscar_produtos.png","/assets/landing/validar.png":"/_cdn/static/c021f130-b9c8-4406-8a88-fb86aac44886-validar_produtos.png","/assets/landing/campanha.png":"/_cdn/static/71cbbdfc-b88a-4fe8-8502-85bf6ab34d24-criar_campanha.png","/assets/landing/conteudo.png":"/_cdn/static/f2a5f0b0-ada2-476d-acc1-1c97d01e4588-criar_conteudo.png","/assets/landing/imagem.png":"/_cdn/static/240944a0-f68b-4946-bd95-d78270e069cf-gerar_imagem.png","/assets/landing/video.png":"/_cdn/static/0502d8b7-c772-43b1-9434-9b5f031a6a8c-video_efeito.png","/assets/landing/biblioteca.png":"/_cdn/static/1308e5b8-0a94-4281-aa08-117a082257eb-biblioteca.png"});
const MEDIA_DIR = join(DATA_DIR, 'landing-images');
const mediaPending = new Map();
mkdirSync(MEDIA_DIR,{recursive:true,mode:0o700});
async function getLandingImage(path) {
 const name=path.split('/').pop();
 const saved=join(MEDIA_DIR,name);
 if (existsSync(saved)) return readFileSync(saved);
 if (!mediaPending.has(path)) mediaPending.set(path,(async ()=>{
  const response=await fetch(MEDIA_HOST+MEDIA_IMAGES[path],{signal:AbortSignal.timeout(16000)});
  if(!response.ok || !response.headers.get('content-type')?.startsWith('image/png'))throw Error('Download do arquivo falhou');
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length<50000||bytes.length>3000000||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('PNG inválido');
  const temporary=saved+'.'+randomUUID()+'.tmp';
  writeFileSync(temporary,bytes,{mode:0o600});renameSync(temporary,saved);
  return bytes;
 })());
 try{return await mediaPending.get(path)}finally{mediaPending.delete(path)}
}

const files = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/assets/screens.svg': ['assets/screens.svg', 'image/svg+xml'],
  '/assets/brand.jpg': ['assets/brand.jpg', 'image/jpeg'],
  '/favicon.svg': ['assets/favicon.svg', 'image/svg+xml']
};
const server = http.createServer(async (req, res) => {
  const path = new URL(req.url || '/', 'http://localhost').pathname;
  if (path === '/healthz') return send(res, 200, { ok: true });
  if (path === '/api/pre-register') {
    if (req.method !== 'POST') return send(res, 405, { error: 'Método não permitido' }, { Allow: 'POST' });
    const origin = req.headers.origin;
    if (origin) { try { if (new URL(origin).host !== req.headers.host) return send(res, 403, { error: 'Origem não permitida' }); } catch { return send(res, 403, { error: 'Origem inválida' }); } }
    const key = req.socket.remoteAddress || 'unknown';
    if (throttle(key)) return send(res, 429, { error: 'Muitas tentativas. Tente novamente mais tarde.' });
    let raw = '';
    try {
      for await (const chunk of req) {
        raw += chunk.toString('utf8');
        if (raw.length > 4096) return send(res, 413, { error: 'Solicitação muito grande' });
      }
      const data = JSON.parse(raw);
      if (data.website) return send(res, 200, { ok: true });
      const email = String(data.email || '').trim().toLowerCase();
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return send(res, 400, { error: 'Informe um e-mail válido.' });
      let id = records.get(email);
      if (!id) {
        id = randomUUID();
        appendFileSync(FILE, JSON.stringify({ id, email, createdAt: new Date().toISOString(), source: 'commercial-preview' }) + '\n', { encoding: 'utf8', flag: 'a', mode: 0o600 });
        records.set(email, id);
      }
      return send(res, 200, { ok: true, registrationId: id, email, next: 'plans' });
    } catch { return send(res, 400, { error: 'Não foi possível processar o e-mail.' }); }
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Método não permitido' });

  if(Object.hasOwn(MEDIA_IMAGES,path)){
    try{
      const bytes=await getLandingImage(path);
      res.writeHead(200,{"Content-Type":"image/png","Content-Length":bytes.length,"Cache-Control":"public, max-age=86400","X-Content-Type-Options":"nosniff"});
      return req.method==="HEAD"?res.end():res.end(bytes);
    }catch(err){console.error('Imagem comercial',path,err.message);return send(res,503,{error:"Imagem temporariamente indisponível"})}
  }
  if (path === '/assets/screens.webp') {
    try {
      const encoded = [1,2,3,4,5].map(i=>readFileSync(join(import.meta.dirname,'assets','screens.b64.'+i),'utf8')).join('');
      const bytes = Buffer.from(encoded,'base64');
      if (bytes.length !== 10204 || bytes.subarray(0,4).toString('ascii') !== 'RIFF' || bytes.subarray(8,12).toString('ascii') !== 'WEBP') throw new Error('Invalid screenshot sprite');
      res.writeHead(200, { 'Content-Type':'image/webp','Cache-Control':'public, max-age=300','X-Content-Type-Options':'nosniff' });
      if (req.method==='HEAD') return res.end();
      return res.end(bytes);
    } catch { return send(res,500,{error:'Imagem indisponível'}); }
  }
  const f = files[path];
  if (!f) return send(res, 404, { error: 'Não encontrado' });
  try {
    const bytes = readFileSync(join(import.meta.dirname, f[0]));
    res.writeHead(200, { 'Content-Type': f[1], 'Cache-Control': 'public, max-age=300', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none';" });
    if (req.method === 'HEAD') return res.end();
    return res.end(bytes);
  } catch { return send(res, 404, { error: 'Arquivo indisponível' }); }
});
server.listen(PORT, '0.0.0.0', () => console.log('commercial preview listening on', PORT));
