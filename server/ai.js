// EduBot AI: 1) jadval/kitob niyatini aniqlash  2) bilim bazasidan qidirish  3) Claude (kalit bo'lsa) yoki ichki javob
const { db } = require('./db');
const cfg = require('./config');
const { nowLocal, addDays, dowOf } = require('./util');

const STOP = new Set('nima va bu bir uchun bilan qanday qaysi menga mening haqida yana kerak boladi bo‘ladi qilib bor yoq emas'.split(' '));
const norm = s => String(s).toLowerCase().replace(/[ʻʼ’‘`´']/g, '');
const stem = w => w.slice(0, 5); // o'zbek tili qo'shimchalari uchun oddiy prefiks
const tokens = s => norm(s).split(/[^a-z0-9а-яё]+/).filter(w => w.length > 2 && !STOP.has(w)).map(stem);

function searchKnowledge(q, k = 3) {
  const qt = [...new Set(tokens(q))]; if (!qt.length) return [];
  const docs = db().knowledge.map(d => ({ d, t: tokens(d.title + ' ' + d.title + ' ' + (d.subject || '') + ' ' + d.text) }));
  const N = docs.length || 1;
  const scored = docs.map(({ d, t }) => {
    let score = 0;
    for (const w of qt) {
      const tf = t.filter(x => x === w).length; if (!tf) continue;
      const df = docs.filter(o => o.t.includes(w)).length;
      score += (tf / (tf + 1.2)) * (Math.log(1 + N / df) + 0.5);
    }
    return { ...d, score };
  });
  return scored.filter(x => x.score > 0.6).sort((a, b) => b.score - a.score).slice(0, k);
}

const DAYS = ['', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'];
const lessonsFor = (user, dow) => db().lessons.filter(l => (user.role === 'admin' || l.group === user.group) && l.day === dow).sort((a, b) => a.start.localeCompare(b.start));
const fmt = l => `${l.start}–${l.end}  ${l.subject} (${l.room}, ${l.teacher})`;

function scheduleAnswer(user, q) {
  const n = nowLocal(), t = norm(q);
  const date = /ertaga/.test(t) ? addDays(n.date, 1) : n.date;
  const dow = dowOf(date), label = /ertaga/.test(t) ? 'Ertaga' : 'Bugun';
  const list = lessonsFor(user, dow);
  const text = list.length ? `${label} (${DAYS[dow]}) darslar:\n` + list.map(fmt).join('\n') : `${label} (${DAYS[dow]}) darslar yo‘q.`;
  return { text, sources: [{ title: 'Dars jadvali', source: 'Jadval bo‘limi' }] };
}
function bookAnswer(q) {
  const qt = tokens(q).filter(w => !['kitob', 'kutub', 'adabi', 'qidir', 'topib', 'beri'].includes(w));
  const hit = db().books.filter(b => qt.some(w => tokens(b.title + ' ' + b.author + ' ' + b.subject).includes(w))).slice(0, 5);
  if (!hit.length) return null;
  return { text: 'Kutubxonada topildi:\n' + hit.map(b => `• ${b.title} — ${b.author} (${b.available > 0 ? b.available + ' nusxa bor' : 'hozir band'}, ${b.location})`).join('\n'), sources: [{ title: 'Kutubxona katalogi', source: 'Kutubxona bo‘limi' }] };
}

async function askClaude(question, context, history) {
  const system = 'Sen EduBot — universitet talabalariga yordam beradigan yordamchisan. O‘zbek tilida, sodda va qisqa javob ber, kerak bo‘lsa misol keltir. FAQAT quyida berilgan materiallarga tayan. Materialda javob bo‘lmasa, buni ochiq ayt va dekanatga yoki o‘qituvchiga murojaat qilishni maslahat ber. Manba qatorini yozma — u alohida ko‘rsatiladi.\n\nMATERIALLAR:\n' + context;
  const messages = [...history.slice(-6).map(m => ({ role: m.role, content: m.text })), { role: 'user', content: question }];
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', signal: AbortSignal.timeout(30000),
    headers: { 'content-type': 'application/json', 'x-api-key': cfg.ai.key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: cfg.ai.model, max_tokens: 800, system, messages }),
  });
  if (!r.ok) throw new Error('Claude API ' + r.status);
  const j = await r.json();
  return j.content.filter(c => c.type === 'text').map(c => c.text).join('\n').trim();
}

async function answer(user, question, history = []) {
  const t = norm(question);
  const wantsSchedule = /jadval/.test(t) || (/\bdars/.test(t) && /(bugun|ertaga|hafta|qachon|nechida)/.test(t));
  if (wantsSchedule) return { ...scheduleAnswer(user, question), mode: 'jadval' };
  if (/(kitob|adabiyot|darslik)/.test(t)) { const b = bookAnswer(question); if (b) return { ...b, mode: 'kutubxona' }; }

  const hits = searchKnowledge(question);
  const sources = hits.map(h => ({ title: h.title, source: h.source }));
  if (cfg.ai.key) {
    try {
      const today = scheduleAnswer(user, 'bugun').text;
      const ctx = (hits.map((h, i) => `[${i + 1}] ${h.title} (${h.source})\n${h.text}`).join('\n\n') || '(mos material topilmadi)') + '\n\nBugungi jadval:\n' + today;
      return { text: await askClaude(question, ctx, history), sources, mode: 'ai' };
    } catch (e) { console.warn('[AI] Claude ishlamadi, ichki rejimga o‘tildi:', e.message); }
  }
  if (!hits.length) return { text: 'Bu savol bo‘yicha materiallardan javob topolmadim. Savolni boshqacha yozib ko‘ring yoki o‘qituvchi/dekanatga murojaat qiling.', sources: [], mode: 'topilmadi' };
  return { text: hits[0].text, sources, mode: 'qidiruv' };
}
module.exports = { answer, searchKnowledge };
