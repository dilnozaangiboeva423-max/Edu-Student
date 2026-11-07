// Xizmatlar monitoringi: sayt/LMS/kutubxona ishlamay qolsa adminlarga SMS.
const { db, save, nextId } = require('./db');
const cfg = require('./config');
const sms = require('./sms');

const state = { internet: { up: null, ms: null, downSince: null, lastCheck: null } };

async function ping(url) {
  const t = Date.now();
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000), redirect: 'follow' });
    return { ok: r.status < 500, ms: Date.now() - t };
  } catch (e) { return { ok: false, ms: Date.now() - t, error: e.name === 'TimeoutError' ? 'timeout' : e.message }; }
}
function adminPhones() {
  const fromUsers = db().users.filter(u => u.role === 'admin' && u.phone).map(u => u.phone);
  return [...new Set([...cfg.monitor.adminPhones, ...fromUsers])];
}
function alertAdmins(text, key) { adminPhones().forEach(p => sms.enqueue({ to: p, text, kind: 'monitor', key: key + ':' + p })); }
const mins = ms => Math.max(1, Math.round(ms / 60000));

async function tick() {
  const now = Date.now(), limit = cfg.monitor.downMinutes * 60000;

  // 1) Internet aloqasi
  const net = await ping(cfg.monitor.internetUrl), I = state.internet;
  I.lastCheck = now; I.ms = net.ms;
  if (!net.ok) { I.downSince ||= now; }
  else if (I.downSince) {
    const dur = now - I.downSince;
    if (dur >= limit) alertAdmins(`EduBot: server interneti ${mins(dur)} daqiqa uzilib, qayta tiklandi.`, 'net:' + I.downSince);
    I.downSince = null;
  }
  I.up = net.ok;

  // 2) Xizmatlar (internet yo'q bo'lsa, xizmat holatini aniqlab bo'lmaydi — tekshirmaymiz)
  if (!net.ok) { save(); return; }
  for (const s of db().services) {
    const r = await ping(s.url);
    s.lastCheck = now; s.ms = r.ms; s.error = r.error || null;
    if (!r.ok) {
      s.downSince ||= now;
      if (!s.alerted && now - s.downSince >= limit) {
        alertAdmins(`EduBot: "${s.name}" ${mins(now - s.downSince)} daqiqadan beri ishlamayapti.`, `down:${s.id}:${s.downSince}`);
        s.alerted = true;
      }
    } else {
      if (s.alerted) alertAdmins(`EduBot: "${s.name}" qayta ishga tushdi.`, `up:${s.id}:${now}`);
      s.downSince = null; s.alerted = false;
    }
    s.up = r.ok;
  }
  save();
}
const status = () => ({ internet: state.internet, services: db().services, thresholdMin: cfg.monitor.downMinutes });
const addService = (name, url) => { const s = { id: nextId(), name, url, up: null, downSince: null, alerted: false, lastCheck: null, ms: null }; db().services.push(s); save(); return s; };
module.exports = { tick, status, addService };
