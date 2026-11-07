'use strict';
/* ===== yordamchilar ===== */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DAYS = ['', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'];
const DS = ['', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
const toMin = h => { const [a, b] = h.split(':').map(Number); return a * 60 + b; };
const dur = m => { m = Math.max(0, Math.round(m)); return m >= 60 ? `${Math.floor(m / 60)} soat ${m % 60} daqiqa` : `${m} daqiqa`; };
const fdt = ts => new Date(ts).toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const ICON = {
  home: 'M3 11l9-8 9 8M5 10v10h14V10', calendar: 'M4 5h16v15H4zM4 10h16M9 3v4M15 3v4', book: 'M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 19V5',
  chat: 'M4 5h16v11H9l-5 4z', bell: 'M6 16v-5a6 6 0 0112 0v5l2 2H4zM10 21h4', check: 'M4 12l5 5L20 6', pulse: 'M3 12h4l3-7 4 14 3-7h4',
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6', edit: 'M4 20h4L19 9l-4-4L4 16z', grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
};
const icon = n => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICON[n]}"/></svg>`;

const S = { token: localStorage.getItem('eb_token'), user: JSON.parse(localStorage.getItem('eb_user') || 'null'), health: {}, timer: null, stale: false };

function toast(msg, bad) { const t = $('#toast'); t.textContent = msg; t.className = 'toast show' + (bad ? ' bad' : ''); clearTimeout(toast.t); toast.t = setTimeout(() => t.className = 'toast', 3200); }
function netBanner() {
  const b = $('#net'), off = !navigator.onLine;
  b.hidden = !(off || S.stale);
  b.textContent = off ? 'Internet yo‘q — oxirgi saqlangan ma’lumotlar ko‘rsatilmoqda' : 'Oflayn rejim: saqlangan ma’lumot ko‘rsatilmoqda';
}
addEventListener('online', () => { S.stale = false; netBanner(); route(); }); addEventListener('offline', netBanner);

async function api(path, { method = 'GET', body } = {}) {
  let r;
  try { r = await fetch('/api' + path, { method, headers: { 'Content-Type': 'application/json', ...(S.token ? { Authorization: 'Bearer ' + S.token } : {}) }, body: body ? JSON.stringify(body) : undefined }); }
  catch { throw Object.assign(new Error('Internet yo‘q. Aloqa tiklangach qayta urinib ko‘ring.'), { offline: true }); }
  if (method === 'GET' && path !== '/health') { S.stale = r.headers.get('x-cache') === '1'; netBanner(); }
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && S.token) logout();
  if (!r.ok) throw Object.assign(new Error(j.error || 'Xatolik'), { status: r.status });
  return j;
}
const guard = fn => async (...a) => { try { return await fn(...a); } catch (e) { toast(e.message, true); } };

function logout() {
  S.token = null; S.user = null; localStorage.removeItem('eb_token'); localStorage.removeItem('eb_user');
  if (window.caches) caches.delete('edubot-api-v1'); // keyingi foydalanuvchi eski ma'lumotni ko'rmasin
  clearInterval(S.timer); location.hash = ''; boot();
}

/* ===== kirish ===== */
function loginView() {
  $('#app').innerHTML = `<div class="login"><form class="card form" id="lf">
    <img src="/icon.svg" alt=""><div><h1>EduBot</h1><p class="muted">Savol ber, bilim ol</p></div>
    <label>Login<input name="login" autocomplete="username" required autofocus></label>
    <label>Parol<input name="password" type="password" autocomplete="current-password" required></label>
    <button class="btn">Kirish</button>
    ${S.health.demo ? '<p class="small muted">Demo: talaba <b>s1001</b> / <b>talaba123</b><br>Admin: <b>admin</b> / <b>admin123</b></p>' : ''}
  </form></div>`;
  $('#lf').onsubmit = guard(async e => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
    const r = await api('/login', { method: 'POST', body: f });
    S.token = r.token; S.user = r.user; localStorage.setItem('eb_token', r.token); localStorage.setItem('eb_user', JSON.stringify(r.user));
    location.hash = ''; boot();
  });
}

/* ===== qobiq va marshrutlash ===== */
const NAV = {
  student: [['home', 'Bugun', 'home'], ['schedule', 'Jadval', 'calendar'], ['library', 'Kutubxona', 'book'], ['ai', 'EduBot', 'chat'], ['inbox', 'Xabarlar', 'bell']],
  admin: [['a-home', 'Umumiy', 'grid'], ['a-att', 'Davomat', 'check'], ['a-content', 'Kontent', 'edit'], ['a-mon', 'Monitoring', 'pulse'], ['a-sms', 'SMS', 'mail']],
};
function shell() {
  const items = NAV[S.user.role];
  $('#app').innerHTML = `<div class="shell"><nav class="nav" aria-label="Asosiy menyu"><div class="brand"><img src="/icon.svg" alt="">EduBot</div>
    ${items.map(([id, label, ic]) => `<a href="#/${id}" data-id="${id}">${icon(ic)}<span>${label}</span></a>`).join('')}
    <div class="who"><b>${esc(S.user.name)}</b><br><span class="muted">${S.user.role === 'admin' ? 'Administrator' : esc(S.user.group || '')}</span><br><button data-act="logout">Chiqish</button></div></nav>
    <main id="view"></main></div>`;
}
const VIEWS = {};
async function route() {
  if (!S.user) return;
  clearInterval(S.timer);
  const def = S.user.role === 'admin' ? 'a-home' : 'home';
  let id = location.hash.replace('#/', '') || def;
  if (!NAV[S.user.role].some(n => n[0] === id)) id = def;
  document.querySelectorAll('.nav a').forEach(a => a.dataset.id === id ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
  const v = $('#view'); v.onclick = null; v.innerHTML = '<p class="muted">Yuklanmoqda…</p>';
  try { await VIEWS[id](v); window.scrollTo(0, 0); } catch (e) { v.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}
addEventListener('hashchange', route);

async function boot() {
  try { S.health = await api('/health'); } catch {}
  if (!S.token || !S.user) return loginView();
  shell(); route();
}

/* ===== TALABA: bugun ===== */
function heroHTML(t) {
  const now = toMin(t.hhmm) + (performance.now() - S.t0) / 60000;
  const L = t.lessons, cur = L.find(l => toMin(l.start) <= now && now < toMin(l.end)), next = L.find(l => toMin(l.start) > now);
  if (cur) { const s = toMin(cur.start), e = toMin(cur.end);
    return `<div class="hero"><div class="label">Hozir dars ketmoqda</div><div class="big">${esc(cur.subject)}</div><div class="meta">${esc(cur.room)} · ${esc(cur.teacher)} · tugashiga ${dur(e - now)}</div><div class="bar"><i style="width:${Math.min(100, (now - s) / (e - s) * 100)}%"></i></div></div>`; }
  if (next) return `<div class="hero idle"><div class="label">Keyingi dars ${next.start} da</div><div class="big">${esc(next.subject)}</div><div class="meta">${esc(next.room)} · ${esc(next.teacher)} · boshlanishiga ${dur(toMin(next.start) - now)}</div></div>`;
  return `<div class="hero idle"><div class="big">${L.length ? 'Bugungi darslar tugadi' : 'Bugun dars yo‘q'}</div><div class="meta">Savolingiz bo‘lsa, EduBot’dan so‘rang — u 24/7 javob beradi.</div></div>`;
}
const stBadge = s => s === 'present' ? '<span class="badge ok">Keldi</span>' : s === 'absent' ? '<span class="badge bad">Kelmadi</span>' : '';
const lessonRow = (l, extra = '') => `<div class="lesson ${extra}"><div class="t">${l.start}<span>${l.end}</span></div><div><b>${esc(l.subject)}</b><div class="muted small">${esc(l.teacher)} · ${esc(l.room)}</div></div>${stBadge(l.status)}</div>`;

function localNow() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' }).formatToParts(new Date()).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, dow: { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[p.weekday], hhmm: `${p.hour}:${p.minute}` };
}
VIEWS.home = async v => {
  let t = await api('/today');
  if (S.stale) { const n = localNow(), sc = await api('/schedule'); t = { ...n, lessons: sc.lessons.filter(l => l.day === n.dow).map(l => ({ ...l, status: null })) }; } // oflayn: jadval keshdan
  S.t0 = performance.now();
  const now = () => toMin(t.hhmm) + (performance.now() - S.t0) / 60000;
  v.innerHTML = `<header class="top"><h1>Salom, ${esc(S.user.name.split(' ')[0])}</h1><p class="muted">${DAYS[t.dow]}, ${t.date}</p></header>
    <section id="hero"></section>
    <section><h2>Bugungi darslar</h2><div class="stack">${t.lessons.map(l => lessonRow(l, toMin(l.start) <= now() && now() < toMin(l.end) ? 'now' : '')).join('') || '<div class="empty">Bugun dars yo‘q</div>'}</div></section>
    <section class="card"><h2>EduBot’dan so‘rang</h2><div class="chips">${['Bugun qanday darslar bor?', 'Normalizatsiya nima?', 'Kutubxona ish vaqti'].map(q => `<button class="chip" data-ask="${esc(q)}">${esc(q)}</button>`).join('')}</div></section>`;
  const paint = () => { $('#hero').innerHTML = heroHTML(t); }; paint(); S.timer = setInterval(paint, 20000);
};

/* ===== TALABA: jadval ===== */
VIEWS.schedule = async v => {
  const { lessons } = await api('/schedule'); let day = new Date().getDay() || 7; if (day === 7) day = 1;
  const draw = () => {
    v.innerHTML = `<header class="top"><h1>Dars jadvali</h1><p class="muted">Guruh: ${esc(S.user.group || 'barcha')} · internet bo‘lmasa ham oxirgi jadval ko‘rinadi</p></header>
      <section><div class="tabs" role="tablist">${[1, 2, 3, 4, 5, 6].map(d => `<button role="tab" aria-selected="${d === day}" data-day="${d}">${DS[d]}</button>`).join('')}</div></section>
      <section><h2>${DAYS[day]}</h2><div class="stack">${lessons.filter(l => l.day === day).map(l => lessonRow(l)).join('') || '<div class="empty">Bu kuni dars yo‘q</div>'}</div></section>`;
    v.querySelectorAll('[data-day]').forEach(b => b.onclick = () => { day = +b.dataset.day; draw(); });
  };
  draw();
};

/* ===== TALABA: kutubxona ===== */
VIEWS.library = async v => {
  v.innerHTML = `<header class="top"><h1>Kutubxona</h1><p class="muted">Kitob qidiring va oldindan bron qiling</p></header>
    <section><input id="q" type="search" placeholder="Kitob nomi, muallif yoki fan…" aria-label="Qidirish"></section>
    <section id="mine"></section><section><h2>Katalog</h2><div id="books" class="grid"></div></section>`;
  const mine = async () => {
    const { items } = await api('/reservations');
    $('#mine').innerHTML = items.length ? `<h2>Mening bronlarim</h2><div class="stack">${items.map(r => `<div class="card row between"><div><b>${esc(r.book.title)}</b><div class="muted small">${esc(r.book.location)} · 2 kun ichida oling</div></div><button class="btn ghost sm" data-cancel="${r.id}">Bekor qilish</button></div>`).join('')}</div>` : '';
  };
  const load = async () => {
    const { books } = await api('/books?q=' + encodeURIComponent($('#q').value));
    $('#books').innerHTML = books.map(b => `<div class="card stack"><div><b>${esc(b.title)}</b><div class="muted small">${esc(b.author)}${b.year ? ', ' + b.year : ''}</div></div>
      <div class="row between"><span class="badge ${b.available ? 'ok' : 'bad'}">${b.available ? b.available + ' nusxa bor' : 'Hozir band'}</span><span class="muted small">${esc(b.location)}</span></div>
      <button class="btn sm" data-reserve="${b.id}" ${b.available ? '' : 'disabled'}>Bron qilish</button></div>`).join('') || '<div class="empty" style="grid-column:1/-1">Hech narsa topilmadi</div>';
  };
  let t; $('#q').oninput = () => { clearTimeout(t); t = setTimeout(guard(load), 250); };
  v.onclick = guard(async e => {
    const r = e.target.closest('[data-reserve]'), c = e.target.closest('[data-cancel]');
    if (r) { const x = await api(`/books/${r.dataset.reserve}/reserve`, { method: 'POST' }); toast(x.message); await Promise.all([mine(), load()]); }
    if (c) { await api(`/reservations/${c.dataset.cancel}`, { method: 'DELETE' }); toast('Bron bekor qilindi'); await Promise.all([mine(), load()]); }
  });
  await Promise.all([mine(), load()]);
};

/* ===== TALABA: AI ===== */
const msgHTML = m => `<div class="msg ${m.role}">${esc(m.text)}${m.sources?.length ? `<span class="src">Manba: ${m.sources.map(s => esc(s.title + (s.source ? ' — ' + s.source : ''))).join('; ')}</span>` : ''}</div>`;
VIEWS.ai = async v => {
  const h = await api('/chat'); let remaining = h.remaining;
  const sample = ['Normalizatsiya nima?', 'SQL JOIN turlari', 'Hosila nima?', 'Bugun qanday darslar bor?', 'Kutubxonada SQL kitoblari'];
  v.innerHTML = `<header class="top"><h1>EduBot</h1><p class="muted">Javoblar universitet materiallariga asoslanadi · ${h.mode === 'ai' ? 'AI rejimi' : 'qidiruv rejimi'}${remaining !== null ? ` · bugun ${remaining} ta savol qoldi` : ''}</p></header>
    <section class="chat" id="chat" aria-live="polite">${h.messages.map(msgHTML).join('') || '<div class="msg assistant">Salom! Fanlar, dars jadvali yoki kutubxona haqida so‘rang. Men materiallardan topib, manba bilan javob beraman.</div>'}</section>
    <section><div class="chips" id="chips">${sample.map(q => `<button class="chip" data-ask="${esc(q)}">${esc(q)}</button>`).join('')}</div></section>
    <form class="composer" id="cf"><input id="ci" placeholder="Savolingizni yozing…" maxlength="600" autocomplete="off" aria-label="Savol"><button class="btn">Yuborish</button></form>`;
  const chat = $('#chat'); chat.scrollTop = chat.scrollHeight; window.scrollTo(0, document.body.scrollHeight);
  let last = [...h.messages].reverse().find(m => m.role === 'user')?.text || '';
  const ask = guard(async text => {
    last = text.startsWith('Soddaroq') || text.startsWith('Yana misol') || text.startsWith('Mini-test') ? last : text;
    chat.insertAdjacentHTML('beforeend', msgHTML({ role: 'user', text }) + '<div class="msg assistant" id="typing"><span class="dots"><span></span><span></span><span></span></span></div>');
    window.scrollTo(0, document.body.scrollHeight);
    try {
      const r = await api('/chat', { method: 'POST', body: { message: text } });
      $('#typing').outerHTML = msgHTML(r.message); remaining = r.remaining;
      $('#chips').innerHTML = ['Soddaroq tushuntir', 'Yana misol keltir', 'Mini-test'].map(c => `<button class="chip" data-ask="${c}: ${esc(last)}">${c}</button>`).join('');
    } catch (e) { $('#typing')?.remove(); throw e; }
    window.scrollTo(0, document.body.scrollHeight);
  });
  $('#cf').onsubmit = e => { e.preventDefault(); const i = $('#ci'); const t = i.value.trim(); if (t) { i.value = ''; ask(t); } };
  v.onclick = e => { const c = e.target.closest('[data-ask]'); if (c) ask(c.dataset.ask); };
};

/* ===== TALABA: xabarlar ===== */
VIEWS.inbox = async v => {
  const [a, n] = await Promise.all([api('/attendance'), api('/notifications')]);
  v.innerHTML = `<header class="top"><h1>Xabarlar va davomat</h1></header>
    <section class="stats"><div class="card stat"><b>${a.present}</b><span class="muted">qatnashgan darslar</span></div><div class="card stat"><b style="color:var(--bad)">${a.absent}</b><span class="muted">qoldirilgan darslar</span></div></section>
    <section><h2>SMS xabarlar</h2><div class="stack">${n.items.map(i => `<div class="card"><div class="row between"><span class="badge ${i.kind === 'absence' ? 'bad' : 'teal'}">${i.kind === 'absence' ? 'Dars qoldirildi' : 'Xabar'}</span><span class="muted small">${fdt(i.at)} · ${i.status === 'sent' ? 'yuborildi' : i.status === 'queued' ? 'navbatda' : 'xato'}</span></div><p style="margin-top:.4rem">${esc(i.text)}</p></div>`).join('') || '<div class="empty">Hozircha xabar yo‘q</div>'}</div></section>
    <section><h2>Davomat tarixi</h2><div class="card"><table><tr><th>Sana</th><th>Fan</th><th>Holat</th></tr>${a.records.map(r => `<tr><td>${r.date}</td><td>${esc(r.subject)}</td><td>${stBadge(r.status)}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">Ma’lumot yo‘q</td></tr>'}</table></div></section>
    <section><button class="btn ghost" data-act="logout">Chiqish (${esc(S.user.name)})</button></section>`;
};

/* ===== ADMIN ===== */
const svcRow = s => `<div class="card row"><span class="dot ${s.up === true ? 'up' : s.up === false ? 'down' : ''}"></span><div class="grow"><b>${esc(s.name)}</b><div class="muted small">${esc(s.url)}</div></div><div class="small muted">${s.up === null ? 'tekshirilmagan' : s.up ? (s.ms ?? '') + ' ms' : 'ishlamayapti' + (s.alerted ? ' · SMS yuborildi' : '')}</div></div>`;

VIEWS['a-home'] = async v => {
  const o = await api('/admin/overview'), m = o.monitor;
  v.innerHTML = `<header class="top"><h1>Umumiy holat</h1></header>
    <section class="stats"><div class="card stat"><b>${o.students}</b><span class="muted">talaba</span></div><div class="card stat"><b>${o.absentToday}</b><span class="muted">bugun kelmagan</span></div><div class="card stat"><b>${o.questionsToday}</b><span class="muted">bugungi AI savollari</span></div><div class="card stat"><b>${o.sms.sent}</b><span class="muted">SMS yuborilgan${o.sms.queued ? ` · ${o.sms.queued} navbatda` : ''}</span></div></section>
    <section><h2>Xizmatlar</h2><div class="stack"><div class="card row"><span class="dot ${m.internet.up ? 'up' : m.internet.up === false ? 'down' : ''}"></span><div class="grow"><b>Server interneti</b></div><span class="small muted">${m.internet.up ? 'barqaror' : m.internet.up === false ? 'uzilgan' : 'tekshirilmagan'}</span></div>${m.services.map(svcRow).join('')}</div></section>
    <section><button class="btn ghost" data-act="logout">Chiqish</button></section>`;
};

VIEWS['a-att'] = async v => {
  let date = (await api('/admin/lessons')).date;
  v.innerHTML = `<header class="top"><h1>Davomat</h1><p class="muted">Kelmagan talabaga avtomatik SMS yuboriladi</p></header>
    <section class="form two"><label>Sana<input type="date" id="ad" value="${date}"></label><label>Dars<select id="al"></select></label></section><section id="alist"></section>`;
  const loadLessons = guard(async () => {
    const r = await api('/admin/lessons?date=' + $('#ad').value);
    $('#al').innerHTML = r.lessons.map(l => `<option value="${l.id}">${l.start} · ${esc(l.subject)} (${esc(l.group)})</option>`).join('') || '<option value="">Bu kuni dars yo‘q</option>';
    await loadList();
  });
  const loadList = guard(async () => {
    const id = $('#al').value; if (!id) { $('#alist').innerHTML = '<div class="empty">Dars topilmadi</div>'; return; }
    const r = await api(`/admin/attendance?lessonId=${id}&date=${$('#ad').value}`);
    $('#alist').innerHTML = `<div class="stack">${r.students.map(s => { const st = s.status || 'present';
      return `<div class="card row between" data-sid="${s.id}"><b>${esc(s.name)}</b><div class="seg"><button class="p" aria-pressed="${st === 'present'}" data-st="present">Keldi</button><button class="a" aria-pressed="${st === 'absent'}" data-st="absent">Kelmadi</button></div></div>`; }).join('') || '<div class="empty">Guruhda talaba yo‘q</div>'}</div><p style="margin-top:1rem"><button class="btn" id="asave">Saqlash va SMS yuborish</button></p>`;
  });
  $('#ad').onchange = loadLessons; $('#al').onchange = loadList;
  v.onclick = guard(async e => {
    const b = e.target.closest('[data-st]');
    if (b) b.parentElement.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
    if (e.target.id === 'asave') {
      const records = [...v.querySelectorAll('[data-sid]')].map(r => ({ studentId: +r.dataset.sid, status: r.querySelector('[aria-pressed=true]').dataset.st }));
      const r = await api('/admin/attendance', { method: 'POST', body: { lessonId: +$('#al').value, date: $('#ad').value, records } });
      toast(`Saqlandi. ${r.smsQueued} ta SMS navbatga qo‘yildi.`);
    }
  });
  await loadLessons();
};

VIEWS['a-content'] = async v => {
  const draw = async () => {
    const [k, sc] = await Promise.all([api('/admin/knowledge'), api('/schedule')]);
    v.innerHTML = `<header class="top"><h1>Kontent</h1><p class="muted">AI shu materiallar asosida javob beradi</p></header>
    <section class="card"><h2>Yangi material</h2><form class="form" id="kf"><div class="form two"><label>Sarlavha<input name="title" required></label><label>Fan<input name="subject"></label><label>Manba<input name="source" placeholder="5-ma’ruza, 3-slayd"></label></div><label>Matn<textarea name="text" rows="4" required></textarea></label><button class="btn">Qo‘shish</button></form></section>
    <section><h2>Bilim bazasi (${k.items.length})</h2><div class="stack">${k.items.map(i => `<div class="card row"><div class="grow"><b>${esc(i.title)}</b><div class="muted small">${esc(i.subject)} · ${esc(i.source)}</div></div><button class="btn danger sm" data-delk="${i.id}">O‘chirish</button></div>`).join('')}</div></section>
    <section class="card"><h2>Dars qo‘shish</h2><form class="form two" id="lf2"><label>Guruh<input name="group" value="DI-21" required></label><label>Kun<select name="day">${[1, 2, 3, 4, 5, 6].map(d => `<option value="${d}">${DAYS[d]}</option>`).join('')}</select></label><label>Boshlanishi<input name="start" type="time" required></label><label>Tugashi<input name="end" type="time" required></label><label>Fan<input name="subject" required></label><label>O‘qituvchi<input name="teacher"></label><label>Xona<input name="room"></label><div style="align-self:end"><button class="btn">Qo‘shish</button></div></form>
      <details style="margin-top:.8rem"><summary>Mavjud darslar (${sc.lessons.length})</summary><table>${sc.lessons.map(l => `<tr><td>${DS[l.day]} ${l.start}</td><td>${esc(l.subject)} (${esc(l.group)})</td><td><button class="btn danger sm" data-dell="${l.id}">×</button></td></tr>`).join('')}</table></details></section>
    <section class="card"><h2>Kitob qo‘shish</h2><form class="form two" id="bf"><label>Nomi<input name="title" required></label><label>Muallif<input name="author"></label><label>Fan / kalit so‘zlar<input name="subject"></label><label>Yil<input name="year" type="number"></label><label>Nusxalar soni<input name="copies" type="number" value="1" min="1"></label><label>Joylashuvi<input name="location"></label><div style="align-self:end"><button class="btn">Qo‘shish</button></div></form></section>`;
  };
  const form = (sel, path, ok) => { $(sel).onsubmit = guard(async e => { e.preventDefault(); await api(path, { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); toast(ok); await draw(); wire(); }); };
  const wire = () => { form('#kf', '/admin/knowledge', 'Material qo‘shildi'); form('#lf2', '/admin/lessons', 'Dars qo‘shildi'); form('#bf', '/admin/books', 'Kitob qo‘shildi'); };
  v.onclick = guard(async e => {
    const k = e.target.closest('[data-delk]'), l = e.target.closest('[data-dell]');
    if (k && confirm('Material o‘chirilsinmi?')) { await api('/admin/knowledge/' + k.dataset.delk, { method: 'DELETE' }); await draw(); wire(); }
    if (l && confirm('Dars o‘chirilsinmi?')) { await api('/admin/lessons/' + l.dataset.dell, { method: 'DELETE' }); await draw(); wire(); }
  });
  await draw(); wire();
};

VIEWS['a-mon'] = async v => {
  const draw = async () => {
    const m = await api('/admin/monitor'); const I = m.internet;
    v.innerHTML = `<header class="top"><h1>Xizmatlar monitoringi</h1><p class="muted">Xizmat ${m.thresholdMin} daqiqadan ortiq ishlamasa, adminlarga SMS yuboriladi</p></header>
      <section class="row"><button class="btn" id="run">Hozir tekshirish</button><span class="muted small">Har daqiqada avtomatik tekshiriladi</span></section>
      <section class="stack"><div class="card row"><span class="dot ${I.up ? 'up' : I.up === false ? 'down' : ''}"></span><div class="grow"><b>Internet aloqasi</b><div class="muted small">${I.up === false ? 'uzilgan · SMS navbatda saqlanadi, aloqa tiklanganda yuboriladi' : I.ms != null ? I.ms + ' ms' : 'tekshirilmagan'}</div></div></div>
      ${m.services.map(s => `<div class="row">${svcRow(s).replace('class="card row"', 'class="card row grow"')}<button class="btn danger sm" data-dels="${s.id}">×</button></div>`).join('')}</section>
      <section class="card"><h2>Xizmat qo‘shish</h2><form class="form two" id="sf"><label>Nomi<input name="name" required></label><label>URL<input name="url" type="url" placeholder="https://lms.universitet.uz" required></label><div style="align-self:end"><button class="btn">Qo‘shish</button></div></form></section>`;
    $('#sf').onsubmit = guard(async e => { e.preventDefault(); await api('/admin/monitor/services', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); await draw(); });
  };
  v.onclick = guard(async e => {
    if (e.target.id === 'run') { e.target.disabled = true; e.target.textContent = 'Tekshirilmoqda…'; await api('/admin/monitor/run', { method: 'POST' }); await draw(); }
    const d = e.target.closest('[data-dels]'); if (d) { await api('/admin/monitor/services/' + d.dataset.dels, { method: 'DELETE' }); await draw(); }
  });
  await draw(); S.timer = setInterval(() => { if (!document.activeElement?.closest('form')) draw().catch(() => {}); }, 15000);
};

VIEWS['a-sms'] = async v => {
  const draw = async () => {
    const r = await api('/admin/sms');
    v.innerHTML = `<header class="top"><h1>SMS jurnali</h1><p class="muted">Provayder: <b>${esc(r.provider)}</b>${r.provider === 'console' ? ' — xabarlar faqat server terminaliga yoziladi' : ''}</p></header>
      <section class="card"><h2>Sinov xabari</h2><form class="form two" id="tf"><label>Raqam<input name="to" placeholder="998901234567" required></label><label>Matn<input name="text" value="EduBot sinov xabari"></label><div style="align-self:end"><button class="btn">Yuborish</button></div></form></section>
      <section><div class="card" style="overflow-x:auto"><table><tr><th>Vaqt</th><th>Raqam</th><th>Turi</th><th>Matn</th><th>Holat</th></tr>${r.items.map(s => `<tr><td>${fdt(s.createdAt)}</td><td>${esc(s.to)}</td><td>${esc(s.kind)}</td><td>${esc(s.text)}</td><td><span class="badge ${s.status === 'sent' ? 'ok' : s.status === 'queued' ? 'warn' : 'bad'}">${s.status}</span>${s.error ? `<div class="small muted">${esc(s.error)}</div>` : ''}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Hali xabar yo‘q</td></tr>'}</table></div></section>`;
    $('#tf').onsubmit = guard(async e => { e.preventDefault(); await api('/admin/sms-test', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); toast('Navbatga qo‘yildi'); setTimeout(draw, 600); });
  };
  await draw();
};

/* ===== umumiy hodisalar ===== */
document.addEventListener('click', e => {
  if (e.target.closest('[data-act=logout]')) logout();
  const a = e.target.closest('[data-ask]');
  if (a && S.user?.role === 'student' && !$('#chat')) { sessionStorage.setItem('eb_pending', a.dataset.ask); location.hash = '#/ai'; }
});
const _ai = VIEWS.ai;
VIEWS.ai = async v => { await _ai(v); const p = sessionStorage.getItem('eb_pending'); if (p) { sessionStorage.removeItem('eb_pending'); $('#ci').value = p; $('#cf').requestSubmit(); } };

if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
netBanner(); boot();
