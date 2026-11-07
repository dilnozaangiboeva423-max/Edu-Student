// SMS navbati: internet bo'lmasa xabar yo'qolmaydi, aloqa tiklangach qayta yuboriladi.
const { db, nextId, save } = require('./db');
const cfg = require('./config');

let eskizToken = null, busy = false;
const normPhone = p => { let d = String(p || '').replace(/\D/g, ''); if (d.length === 9) d = '998' + d; return /^998\d{9}$/.test(d) ? d : null; };

function enqueue({ to, text, kind = 'info', key = null, userId = null }) {
  if (key && db().sms.some(s => s.key === key)) return null; // takroriy yuborilmasin
  const phone = normPhone(to);
  const rec = { id: nextId(), to: phone || String(to), text, kind, key, userId, status: phone ? 'queued' : 'failed', attempts: 0, createdAt: Date.now(), sentAt: null, error: phone ? null : 'Telefon raqami noto‘g‘ri' };
  db().sms.push(rec); save();
  setImmediate(processQueue);
  return rec;
}

async function eskizLogin() {
  const r = await fetch('https://notify.eskiz.uz/api/auth/login', { method: 'POST', body: new URLSearchParams({ email: cfg.sms.email, password: cfg.sms.password }), signal: AbortSignal.timeout(10000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.data?.token) throw new Error('Eskiz login xatosi: ' + r.status);
  return j.data.token;
}
async function eskizSend(rec) {
  const body = new URLSearchParams({ mobile_phone: rec.to, message: rec.text, from: cfg.sms.from });
  return fetch('https://notify.eskiz.uz/api/message/sms/send', { method: 'POST', headers: { Authorization: 'Bearer ' + eskizToken }, body, signal: AbortSignal.timeout(10000) });
}
async function deliver(rec) {
  if (cfg.sms.provider !== 'eskiz') { console.log(`[SMS → ${rec.to}] ${rec.text}`); return; }
  try {
    if (!eskizToken) eskizToken = await eskizLogin();
    let r = await eskizSend(rec);
    if (r.status === 401) { eskizToken = await eskizLogin(); r = await eskizSend(rec); }
    if (!r.ok) throw new Error('Eskiz javobi: ' + r.status);
  } catch (err) {
    if (err.name === 'TimeoutError' || err instanceof TypeError) err.network = true; // internet yo'q
    throw err;
  }
}

async function processQueue() {
  if (busy) return; busy = true;
  try {
    for (const r of db().sms.filter(s => s.status === 'queued')) {
      r.attempts++;
      try { await deliver(r); r.status = 'sent'; r.sentAt = Date.now(); r.error = null; }
      catch (err) { r.error = String(err.message || err); if (r.attempts >= 30) r.status = 'failed'; if (err.network) break; }
    }
    save();
  } finally { busy = false; }
}
module.exports = { enqueue, processQueue, normPhone };
