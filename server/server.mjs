// Beauty by Kae — site server (no dependencies).
// Serves the public site and the admin API. Data lives in ../data (never served).
// Usage: node server/server.mjs [port]      Set the admin password: node server/set-password.mjs
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile, writeFile, stat, mkdir, rename } from 'node:fs/promises';
import { join, normalize, extname, dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID } from 'node:crypto';
import { verifyPassword } from './password.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = process.env.KAE_DATA_DIR || join(root, 'data');
const port = Number(process.env.PORT || process.argv[2] || 5178);

const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8',
};
// Only these top-level entries are public (exact, case-sensitive match — macOS disks ignore case,
// so a blocklist like "data" could be dodged with /DATA/). Everything else is a 404.
const PUBLIC = new Set(['index.html', 'styles.css', 'main.js', 'admin', 'brand', 'img', 'vendor', 'email', 'print']);
const SECURITY_HEADERS = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin' };

/* ---------- Storage: appointments kept in memory, writes queued one at a time ---------- */
async function readJSON(name, fallback) {
  try { return JSON.parse(await readFile(join(dataDir, name), 'utf8')); }
  catch (err) { if (err.code === 'ENOENT') return fallback; throw err; }   // a broken file must not be overwritten
}
async function writeJSON(name, value) {
  await mkdir(dataDir, { recursive: true });
  const tmp = join(dataDir, `.${name}.${randomBytes(4).toString('hex')}.tmp`);
  await writeFile(tmp, JSON.stringify(value, null, 2));
  await rename(tmp, join(dataDir, name));
}
let appts = null;                       // loaded on first use
let queue = Promise.resolve();
function withAppointments(change) {     // read-modify-write, serialized so two saves can't overwrite each other
  const run = queue.then(async () => {
    appts ??= await readJSON('appointments.json', []);
    const result = await change(appts);
    if (result?.save) await writeJSON('appointments.json', appts);
    return result;
  });
  queue = run.catch(() => {});
  return run;
}

/* ---------- Sessions & login throttling ---------- */
const SESSION_HOURS = 12;
const sessions = new Map();            // token -> expiry (ms)
const attempts = new Map();            // ip -> { count, until }
setInterval(() => {                    // drop expired entries
  const now = Date.now();
  for (const [k, exp] of sessions) if (exp <= now) sessions.delete(k);
  for (const [ip, a] of attempts) if (a.until <= now) attempts.delete(ip);
}, 3600_000).unref();

function cookieToken(req) {
  const m = /(?:^|;\s*)kae_admin=([a-f0-9]{64})/.exec(req.headers.cookie || '');
  return m ? m[1] : null;
}
function isAuthed(req) {
  const t = cookieToken(req), exp = t && sessions.get(t);
  if (!exp) return false;
  if (exp > Date.now()) return true;
  sessions.delete(t);
  return false;
}
function sessionCookie(req, token, maxAge) {
  const secure = req.headers['x-forwarded-proto'] === 'https' || req.socket.encrypted ? '; Secure' : '';
  return `kae_admin=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure}`;
}

/* ---------- Helpers ---------- */
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...SECURITY_HEADERS, ...headers });
  res.end(JSON.stringify(body));
}
async function readBody(req, limit = 100_000) {
  const chunks = []; let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw new HttpError(413, 'Too much data.');
    chunks.push(c);
  }
  return Buffer.concat(chunks).toString('utf8');
}
async function readJsonBody(req) {
  if (!/^application\/json\b/.test(req.headers['content-type'] || '')) throw new HttpError(415, 'Send JSON.');
  let data;
  try { data = JSON.parse(await readBody(req)); } catch (err) { if (err instanceof HttpError) throw err; throw new HttpError(400, 'Bad request.'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new HttpError(400, 'Bad request.');
  return data;
}
// Writes must come from this site (the cookie is SameSite=Strict too; this also covers sibling subdomains).
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}
const clean = (v, max) => String(v ?? '').trim().slice(0, max);
function realDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number), dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;   // rejects Feb 31
}

function validAppointment(input) {
  const a = {
    date: clean(input.date, 10),
    time: clean(input.time, 5),
    instagram: clean(input.instagram, 31).replace(/^@+/, '').replace(/[^A-Za-z0-9._]/g, ''),
    name: clean(input.name, 80),
    service: clean(input.service, 80),
    notes: clean(input.notes, 1000),
    duration: Math.min(600, Math.max(15, Math.round(Number(input.duration) || 60))),
  };
  if (!realDate(a.date)) return { error: 'Pick a valid date.' };
  if (a.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(a.time)) return { error: 'Pick a valid time.' };
  if (!a.instagram && !a.name) return { error: 'Add an Instagram handle or a name.' };
  return { value: a };
}

/* ---------- Admin API ---------- */
async function api(req, res, path) {
  if (req.method !== 'GET' && !sameOrigin(req)) return send(res, 403, { error: 'Not allowed.' });

  if (path === '/api/admin/login' && req.method === 'POST') {
    const ip = req.socket.remoteAddress, now = Date.now();
    const prev = attempts.get(ip), live = prev && prev.until > now;
    if (live && prev.count >= 5) return send(res, 429, { error: 'Too many tries. Wait 10 minutes.' });
    // Count the try before checking it, so parallel guesses can't slip past the limit.
    attempts.set(ip, { count: (live ? prev.count : 0) + 1, until: now + 10 * 60_000 });
    const { password = '' } = await readJsonBody(req);
    const cfg = await readJSON('admin.json', null);
    if (!cfg) return send(res, 503, { error: 'No admin password set yet. Run: node server/set-password.mjs' });
    if (!(await verifyPassword(String(password), cfg.hash))) return send(res, 401, { error: 'Wrong password.' });
    attempts.delete(ip);
    const token = randomBytes(32).toString('hex');
    sessions.set(token, now + SESSION_HOURS * 3600_000);
    return send(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(req, token, SESSION_HOURS * 3600) });
  }

  if (path === '/api/admin/logout' && req.method === 'POST') {
    const t = cookieToken(req); if (t) sessions.delete(t);
    return send(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(req, '', 0) });
  }

  if (path === '/api/admin/session') return send(res, 200, { authed: isAuthed(req) });

  if (!isAuthed(req)) return send(res, 401, { error: 'Please log in.' });

  if (path === '/api/admin/appointments') {
    if (req.method === 'GET') {
      const month = new URL(req.url, 'http://x').searchParams.get('month'); // YYYY-MM
      const list = await withAppointments(all => (month ? all.filter(a => a.date.startsWith(month)) : [...all]));
      return send(res, 200, list.sort((x, y) => (x.date + x.time).localeCompare(y.date + y.time)));
    }
    if (req.method === 'POST') {
      const { value, error } = validAppointment(await readJsonBody(req));
      if (error) return send(res, 400, { error });
      const appt = { id: randomUUID(), ...value, created: new Date().toISOString() };
      await withAppointments(all => { all.push(appt); return { save: true }; });
      return send(res, 201, appt);
    }
  }

  const m = /^\/api\/admin\/appointments\/([0-9a-f-]{36})$/.exec(path);
  if (m && (req.method === 'PUT' || req.method === 'DELETE')) {
    let value;
    if (req.method === 'PUT') {
      const v = validAppointment(await readJsonBody(req));
      if (v.error) return send(res, 400, { error: v.error });
      value = v.value;
    }
    const out = await withAppointments(all => {
      const i = all.findIndex(a => a.id === m[1]);
      if (i < 0) return { missing: true };
      if (value) all[i] = { ...all[i], ...value, updated: new Date().toISOString() };
      else all.splice(i, 1);
      return { save: true, item: all[i] };
    });
    if (out.missing) return send(res, 404, { error: 'Appointment not found.' });
    return send(res, 200, value ? out.item : { ok: true });
  }
  return send(res, 404, { error: 'Not found.' });
}

/* ---------- Static files ---------- */
async function serveFile(req, res, path) {
  if (path === '/') path = '/index.html';
  const file = normalize(join(root, path));
  if (!file.startsWith(root + sep)) throw new HttpError(404, 'Not found');
  const parts = file.slice(root.length + 1).split(sep);
  if (!PUBLIC.has(parts[0]) || parts.some(p => p.startsWith('.'))) throw new HttpError(404, 'Not found');

  let target = file, info = await stat(target);
  if (info.isDirectory()) {
    if (!path.endsWith('/')) {                       // /admin -> /admin/ so relative links resolve
      res.writeHead(301, { Location: path + '/', ...SECURITY_HEADERS });
      return res.end();
    }
    target = join(file, 'index.html');
    info = await stat(target);
  }
  const type = types[extname(target).toLowerCase()] || 'application/octet-stream';
  const modified = info.mtime.toUTCString();
  const headers = {
    'Content-Type': type,
    'Last-Modified': modified,
    // pages, CSS and JS revalidate (cheap 304s); images and fonts can be cached for a day
    'Cache-Control': /^(image|font)\//.test(type) ? 'public, max-age=86400' : 'no-cache',
    ...SECURITY_HEADERS,
    ...(parts[0] === 'admin' ? { 'X-Robots-Tag': 'noindex', 'X-Frame-Options': 'DENY' } : {}),
  };
  if (req.headers['if-modified-since'] === modified) { res.writeHead(304, headers); return res.end(); }
  res.writeHead(200, { ...headers, 'Content-Length': info.size });
  if (req.method === 'HEAD') return res.end();
  createReadStream(target).on('error', () => res.destroy()).pipe(res);
}

/* ---------- Server ---------- */
createServer(async (req, res) => {
  try {
    let path;
    try { path = decodeURIComponent(new URL(req.url, 'http://x').pathname); }
    catch { throw new HttpError(400, 'Bad request'); }

    if (path.startsWith('/api/admin/')) return await api(req, res, path);

    if (req.method === 'POST') {
      // Website forms have no backend yet: read at most 1 MB, log the field names, answer OK.
      const body = await readBody(req, 1_000_000).catch(() => '');
      const fields = [...body.matchAll(/name="([^"]+)"(?:; filename="([^"]*)")?/g)]
        .map(([, n, f]) => (f !== undefined ? `${n}=<file ${f}>` : n));
      console.log(`POST ${path}: ${fields.join(', ') || '(no fields)'}`);
      return send(res, 200, { ok: true });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Method not allowed');
    await serveFile(req, res, path);
  } catch (err) {
    const status = err instanceof HttpError ? err.status : ['ENOENT', 'ENOTDIR', 'EISDIR'].includes(err.code) ? 404 : 500;
    if (status === 500) console.error(err);
    if (res.headersSent) return res.destroy();
    if (req.url.startsWith('/api/')) return send(res, status, { error: status === 500 ? 'Something went wrong.' : err.message });
    res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...SECURITY_HEADERS });
    res.end(status === 404 ? 'Not found' : status === 500 ? 'Something went wrong' : err.message);
  }
}).listen(port, () => console.log(`Beauty by Kae on http://localhost:${port}  (admin: /admin/)`));
