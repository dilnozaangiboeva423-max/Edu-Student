const http = require('http');
const fs = require('fs');
const path = require('path');
const cfg = require('./config');
const store = require('./db');
const { hash, verify, sign, unsign } = require('./auth');
const { nowLocal, dowOf, httpErr, validDate } = require('./util');
const sms = require('./sms');
const monitor = require('./monitor');
const ai = require('./ai');

const isNew = store.load();
if (isNew) require('./seed')();
const { db, nextId, save } = store;

/* ---------- yordamchilar ---------- */
const PUB = path.join(cfg.root, 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };
const pub = u => ({ id: u.id, name: u.name, login: u.login, role: u.role, group: u.group || null, phone: u.phone || null });
const clean = (s, max = 4000) => String(s ?? '').trim().slice(0, max);
const need = (v, msg) => { if (!v) throw httpErr(400, msg); return v; };
const normText = s => String(s).toLowerCase().replace(/[ʻʼ’‘`´']/g, '');
const lessonsOf = (u, dow) => db().lessons.filter(l => (u.role === 'admin' || l.group === u.group) && l.day === dow).sort((a, b) => a.start.localeCompare(b.start));
const timeOk = s => /^([01]\d|2[0-3]):[0-5]\d$/.test(s || '');

const routes = [];
const route = (method, pattern, access, fn) => routes.push({ method, access, fn, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$') });

/* ---------- ochiq ---------- */
route('GET', '/api/health', 'public', () => ({ ok: true, demo: cfg.demoHint, ai: !!cfg.ai.key, sms: cfg.sms.provider }));

const attempts = new Map();
route('POST', '/api/login', 'public', ({ body, ip }) => {
  const a = attempts.get(ip) || { n: 0, t: Date.now() };
  if (Date.now() - a.t > 6e5) { a.n = 0; a.t = Date.now(); }
  if (a.n >= 10) throw httpErr(429, 'Juda ko‘p urinish. 10 daqiqadan so‘ng qayta urinib ko‘ring.');
  const u = db().users.find(x => x.login === clean(body.login, 60).toLowerCase());
  if (!u || !verify(clean(body.password, 200), u.pass)) { a.n++; attempts.set(ip, a); throw httpErr(401, 'Login yoki parol noto‘g‘ri'); }
  attempts.delete(ip);
  return { token: sign({ id: u.id, exp: Date.now() + 7 * 864e5 }), user: pub(u) };
});

/* ---------- talaba ---------- */
route('GET', '/api/me', 'user', ({ user }) => ({ user: pub(user) }));

route('GET', '/api/schedule', 'user', ({ user, query }) => {
  const group = user.role === 'admin' ? query.group : user.group;
  return { lessons: db().lessons.filter(l => !group || l.group === group).sort((a, b) => a.day - b.day || a.start.localeCompare(b.start)) };
});

route('GET', '/api/today', 'user', ({ user }) => {
  const n = nowLocal();
  const att = db().attendance.filter(a => a.studentId === user.id && a.date === n.date);
  return { ...n, lessons: lessonsOf(user, n.dow).map(l => ({ ...l, status: att.find(a => a.lessonId === l.id)?.status || null })) };
});

route('GET', '/api/attendance', 'user', ({ user }) => {
  const rows = db().attendance.filter(a => a.studentId === user.id).sort((a, b) => b.date.localeCompare(a.date)).map(a => {
    const l = db().lessons.find(x => x.id === a.lessonId);
    return { ...a, subject: l?.subject || '—', start: l?.start, end: l?.end };
  });
  return { records: rows, absent: rows.filter(r => r.status === 'absent').length, present: rows.filter(r => r.status === 'present').length };
});

route('GET', '/api/notifications', 'user', ({ user }) => ({
  items: db().sms.filter(s => s.userId === user.id).sort((a, b) => b.createdAt - a.createdAt).slice(0, 50).map(s => ({ id: s.id, text: s.text, kind: s.kind, status: s.status, at: s.createdAt })),
}));

route('GET', '/api/books', 'user', ({ query }) => {
  const words = normText(query.q || '').split(/\s+/).filter(Boolean);
  const list = db().books.filter(b => { const t = normText(b.title + ' ' + b.author + ' ' + b.subject); return words.every(w => t.includes(w)); });
  return { books: list.sort((a, b) => a.title.localeCompare(b.title)) };
});
route('GET', '/api/reservations', 'user', ({ user }) => ({
  items: db().reservations.filter(r => r.userId === user.id && r.status === 'active').map(r => ({ ...r, book: db().books.find(b => b.id === r.bookId) })),
}));
route('POST', '/api/books/:id/reserve', 'user', ({ user, params }) => {
  const b = db().books.find(x => x.id === +params.id); if (!b) throw httpErr(404, 'Kitob topilmadi');
  if (db().reservations.some(r => r.userId === user.id && r.bookId === b.id && r.status === 'active')) throw httpErr(409, 'Bu kitob allaqachon bron qilingan');
  if (b.available < 1) throw httpErr(409, 'Hozir bo‘sh nusxa yo‘q');
  b.available--;
  const r = { id: nextId(), bookId: b.id, userId: user.id, status: 'active', createdAt: Date.now() };
  db().reservations.push(r); save();
  return { reservation: r, message: `"${b.title}" bron qilindi. Kutubxonadan (${b.location}) 2 kun ichida oling.` };
});
route('DELETE', '/api/reservations/:id', 'user', ({ user, params }) => {
  const r = db().reservations.find(x => x.id === +params.id && x.userId === user.id && x.status === 'active'); if (!r) throw httpErr(404, 'Bron topilmadi');
  r.status = 'cancelled'; const b = db().books.find(x => x.id === r.bookId); if (b) b.available++; save();
  return { ok: true };
});

const usedToday = (u, date) => db().usage.find(x => x.userId === u.id && x.date === date)?.count || 0;
route('GET', '/api/chat', 'user', ({ user }) => {
  const n = nowLocal();
  return { messages: db().chats.filter(c => c.userId === user.id).slice(-40), remaining: user.role === 'admin' ? null : Math.max(0, cfg.ai.dailyLimit - usedToday(user, n.date)), mode: cfg.ai.key ? 'ai' : 'qidiruv' };
});
route('POST', '/api/chat', 'user', async ({ user, body }) => {
  const q = need(clean(body.message, 600), 'Savol bo‘sh');
  const n = nowLocal();
  if (user.role !== 'admin' && usedToday(user, n.date) >= cfg.ai.dailyLimit) throw httpErr(429, `Bugungi bepul limit (${cfg.ai.dailyLimit} ta savol) tugadi. Ertaga qayta urinib ko‘ring.`);
  const history = db().chats.filter(c => c.userId === user.id).slice(-6);
  const res = await ai.answer(user, q, history);
  let u = db().usage.find(x => x.userId === user.id && x.date === n.date);
  if (!u) db().usage.push(u = { userId: user.id, date: n.date, count: 0 });
  u.count++;
  const at = Date.now();
  db().chats.push({ id: nextId(), userId: user.id, role: 'user', text: q, at });
  const reply = { id: nextId(), userId: user.id, role: 'assistant', text: res.text, sources: res.sources, mode: res.mode, at: at + 1 };
  db().chats.push(reply);
  if (db().chats.length > 3000) db().chats.splice(0, db().chats.length - 3000);
  save();
  return { message: reply, remaining: user.role === 'admin' ? null : Math.max(0, cfg.ai.dailyLimit - u.count) };
});
route('DELETE', '/api/chat', 'user', ({ user }) => { db().chats = db().chats.filter(c => c.userId !== user.id); save(); return { ok: true }; });

/* ---------- admin ---------- */
route('GET', '/api/admin/overview', 'admin', () => {
  const n = nowLocal(), D = db();
  return {
    students: D.users.filter(u => u.role === 'student').length,
    absentToday: D.attendance.filter(a => a.date === n.date && a.status === 'absent').length,
    questionsToday: D.usage.filter(u => u.date === n.date).reduce((s, u) => s + u.count, 0),
    sms: { sent: D.sms.filter(s => s.status === 'sent').length, queued: D.sms.filter(s => s.status === 'queued').length, failed: D.sms.filter(s => s.status === 'failed').length },
    monitor: monitor.status(),
  };
});
route('GET', '/api/admin/students', 'admin', () => ({ students: db().users.filter(u => u.role === 'student').map(pub) }));
route('GET', '/api/admin/lessons', 'admin', ({ query }) => {
  const date = validDate(query.date) ? query.date : nowLocal().date;
  return { date, lessons: db().lessons.filter(l => l.day === dowOf(date)).sort((a, b) => a.start.localeCompare(b.start)) };
});
route('GET', '/api/admin/attendance', 'admin', ({ query }) => {
  const lesson = db().lessons.find(l => l.id === +query.lessonId); if (!lesson) throw httpErr(404, 'Dars topilmadi');
  if (!validDate(query.date)) throw httpErr(400, 'Sana noto‘g‘ri');
  const students = db().users.filter(u => u.role === 'student' && u.group === lesson.group).map(s => ({ id: s.id, name: s.name, status: db().attendance.find(a => a.lessonId === lesson.id && a.studentId === s.id && a.date === query.date)?.status || null }));
  return { lesson, students };
});
route('POST', '/api/admin/attendance', 'admin', ({ body }) => {
  const lesson = db().lessons.find(l => l.id === +body.lessonId); if (!lesson) throw httpErr(404, 'Dars topilmadi');
  if (!validDate(body.date)) throw httpErr(400, 'Sana noto‘g‘ri');
  if (body.date > nowLocal().date) throw httpErr(400, 'Kelajak sanasi uchun davomat belgilab bo‘lmaydi');
  let queued = 0;
  for (const r of Array.isArray(body.records) ? body.records : []) {
    const st = db().users.find(u => u.id === +r.studentId && u.role === 'student' && u.group === lesson.group);
    if (!st || !['present', 'absent'].includes(r.status)) continue;
    let rec = db().attendance.find(a => a.lessonId === lesson.id && a.studentId === st.id && a.date === body.date);
    if (!rec) db().attendance.push(rec = { id: nextId(), lessonId: lesson.id, studentId: st.id, date: body.date });
    rec.status = r.status;
    if (r.status === 'absent') {
      const out = sms.enqueue({ to: st.phone, userId: st.id, kind: 'absence', key: `absent:${st.id}:${lesson.id}:${body.date}`,
        text: `EduBot: ${st.name}, siz ${body.date} kuni soat ${lesson.start} dagi "${lesson.subject}" darsiga kelmadingiz. Sababli bo‘lsa, 3 kun ichida dekanatga murojaat qiling.` });
      if (out) queued++;
    }
  }
  save();
  return { ok: true, smsQueued: queued };
});

route('GET', '/api/admin/knowledge', 'admin', () => ({ items: db().knowledge }));
route('POST', '/api/admin/knowledge', 'admin', ({ body }) => {
  const k = { id: nextId(), title: need(clean(body.title, 150), 'Sarlavha kerak'), subject: clean(body.subject, 100), source: clean(body.source, 150) || 'Ichki material', text: need(clean(body.text, 6000), 'Matn kerak') };
  db().knowledge.push(k); save(); return { item: k };
});
route('DELETE', '/api/admin/knowledge/:id', 'admin', ({ params }) => { db().knowledge = db().knowledge.filter(k => k.id !== +params.id); save(); return { ok: true }; });

route('POST', '/api/admin/lessons', 'admin', ({ body }) => {
  const l = { id: nextId(), group: need(clean(body.group, 30), 'Guruh kerak'), day: +body.day, start: body.start, end: body.end, subject: need(clean(body.subject, 100), 'Fan nomi kerak'), teacher: clean(body.teacher, 80), room: clean(body.room, 30) };
  if (!(l.day >= 1 && l.day <= 7) || !timeOk(l.start) || !timeOk(l.end)) throw httpErr(400, 'Kun yoki vaqt noto‘g‘ri (HH:MM)');
  db().lessons.push(l); save(); return { lesson: l };
});
route('DELETE', '/api/admin/lessons/:id', 'admin', ({ params }) => { db().lessons = db().lessons.filter(l => l.id !== +params.id); save(); return { ok: true }; });
route('POST', '/api/admin/books', 'admin', ({ body }) => {
  const copies = Math.max(1, Math.min(999, +body.copies || 1));
  const b = { id: nextId(), title: need(clean(body.title, 150), 'Nomi kerak'), author: clean(body.author, 100), subject: clean(body.subject, 150), year: +body.year || null, copies, available: copies, location: clean(body.location, 60) };
  db().books.push(b); save(); return { book: b };
});

route('GET', '/api/admin/monitor', 'admin', () => monitor.status());
route('POST', '/api/admin/monitor/run', 'admin', async () => { await monitor.tick(); return monitor.status(); });
route('POST', '/api/admin/monitor/services', 'admin', ({ body }) => {
  const url = clean(body.url, 300); if (!/^https?:\/\//i.test(url)) throw httpErr(400, 'URL http:// yoki https:// bilan boshlanishi kerak');
  return { service: monitor.addService(need(clean(body.name, 80), 'Nomi kerak'), url) };
});
route('DELETE', '/api/admin/monitor/services/:id', 'admin', ({ params }) => { db().services = db().services.filter(s => s.id !== +params.id); save(); return { ok: true }; });
route('GET', '/api/admin/sms', 'admin', () => ({ items: db().sms.slice(-100).reverse(), provider: cfg.sms.provider }));
route('POST', '/api/admin/sms-test', 'admin', ({ body }) => {
  if (!sms.normPhone(body.to)) throw httpErr(400, 'Telefon raqami noto‘g‘ri (998XXXXXXXXX)');
  return { sms: sms.enqueue({ to: body.to, text: clean(body.text, 300) || 'EduBot sinov xabari', kind: 'test' }) };
});

/* ---------- HTTP server ---------- */
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > 1e6) { reject(httpErr(413, 'So‘rov juda katta')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {}); } catch { reject(httpErr(400, 'JSON xato')); } });
    req.on('error', reject);
  });
}
const send = (res, code, obj) => { const b = JSON.stringify(obj); res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(b); };

async function handleApi(req, res, url) {
  try {
    let match, r;
    for (const x of routes) { if (x.method !== req.method) continue; const m = x.re.exec(url.pathname); if (m) { r = x; match = m; break; } }
    if (!r) return send(res, 404, { error: 'Topilmadi' });
    let user = null;
    if (r.access !== 'public') {
      const p = unsign((req.headers.authorization || '').replace(/^Bearer /, ''));
      user = p && db().users.find(u => u.id === p.id);
      if (!user) return send(res, 401, { error: 'Tizimga kiring' });
      if (r.access === 'admin' && user.role !== 'admin') return send(res, 403, { error: 'Ruxsat yo‘q' });
    }
    const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await readBody(req) : {};
    const out = await r.fn({ user, params: match.groups || {}, query: Object.fromEntries(url.searchParams), body, ip: req.socket.remoteAddress });
    send(res, 200, out);
  } catch (e) {
    if (!e.status) console.error(e);
    send(res, e.status || 500, { error: e.status ? e.message : 'Server xatosi' });
  }
}

function serveStatic(req, res, url) {
  let p = decodeURIComponent(url.pathname); if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(PUB, p));
  if (!file.startsWith(PUB + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Topilmadi'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': p === '/sw.js' || p === '/index.html' ? 'no-cache' : 'public, max-age=300', 'X-Content-Type-Options': 'nosniff' });
    res.end(buf);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) return handleApi(req, res, url);
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  serveStatic(req, res, url);
});

function start(port = cfg.port, background = true) {
  return new Promise(resolve => server.listen(port, () => {
    if (background) {
      setInterval(sms.processQueue, 30000);
      setTimeout(() => monitor.tick().catch(console.error), 3000);
      setInterval(() => monitor.tick().catch(console.error), cfg.monitor.intervalSec * 1000);
    }
    resolve(server);
  }));
}
function shutdown() { store.flush(); process.exit(0); }
if (require.main === module) {
  start().then(() => {
    console.log(`\n  EduBot ishga tushdi:  http://localhost:${cfg.port}`);
    console.log(`  SMS: ${cfg.sms.provider} | AI: ${cfg.ai.key ? 'Claude' : 'ichki qidiruv'}`);
    if (isNew) console.log('  Demo kirish: talaba s1001 / talaba123   admin / admin123\n');
  });
  process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
}
module.exports = { start, server };
