import http from 'node:http';
import { readFileSync, appendFileSync, existsSync, mkdirSync, openSync, closeSync, chmodSync } from 'node:fs';
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
