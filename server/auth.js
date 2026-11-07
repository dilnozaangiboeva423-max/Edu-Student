const crypto = require('crypto');
const cfg = require('./config');

const hash = (pw, salt = crypto.randomBytes(16).toString('hex')) => salt + ':' + crypto.scryptSync(pw, salt, 32).toString('hex');
function verify(pw, stored) {
  const [salt, h] = String(stored).split(':');
  const a = Buffer.from(h, 'hex'), b = crypto.scryptSync(String(pw), salt, 32);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const mac = b => crypto.createHmac('sha256', cfg.secret).update(b).digest('base64url');
const sign = payload => { const b = Buffer.from(JSON.stringify(payload)).toString('base64url'); return b + '.' + mac(b); };
function unsign(token) {
  const [b, s] = String(token || '').split('.');
  if (!b || !s) return null;
  const good = mac(b);
  if (s.length !== good.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(good))) return null;
  try { const p = JSON.parse(Buffer.from(b, 'base64url').toString()); return p.exp > Date.now() ? p : null; } catch { return null; }
}
module.exports = { hash, verify, sign, unsign };
