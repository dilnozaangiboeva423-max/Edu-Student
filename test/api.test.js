const test = require('node:test');
const assert = require('node:assert');
const os = require('os');
const path = require('path');
process.env.DATA_FILE = path.join(os.tmpdir(), `edubot-test-${Date.now()}.json`);
process.env.SMS_PROVIDER = 'console';

const { start, server } = require('../server/index.js');
let base;
const call = async (method, url, body, token) => {
  const r = await fetch(base + url, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json() };
};
test.before(async () => { await start(0, false); base = 'http://localhost:' + server.address().port; });
test.after(() => server.close());

test('login, jadval va dars', async () => {
  const bad = await call('POST', '/api/login', { login: 's1001', password: 'xato' });
  assert.equal(bad.status, 401);
  const { data } = await call('POST', '/api/login', { login: 's1001', password: 'talaba123' });
  assert.ok(data.token);
  const sch = await call('GET', '/api/schedule', null, data.token);
  assert.ok(sch.data.lessons.length > 5);
  assert.equal((await call('GET', '/api/admin/overview', null, data.token)).status, 403);
});

test('AI: bilim bazasi va jadval', async () => {
  const { data: { token } } = await call('POST', '/api/login', { login: 's1001', password: 'talaba123' });
  const a = await call('POST', '/api/chat', { message: 'Normalizatsiya nima?' }, token);
  assert.match(a.data.message.text, /takrorlanuvchi/);
  assert.ok(a.data.message.sources.length);
  const b = await call('POST', '/api/chat', { message: 'Dushanba kuni qanday dars bor, jadval' }, token);
  assert.equal(b.data.message.mode, 'jadval');
});

test('kutubxona bron', async () => {
  const { data: { token } } = await call('POST', '/api/login', { login: 's1002', password: 'talaba123' });
  const { data: { books } } = await call('GET', '/api/books?q=sql', null, token);
  assert.ok(books.length);
  const r = await call('POST', `/api/books/${books[0].id}/reserve`, null, token);
  assert.equal(r.status, 200);
  assert.equal((await call('POST', `/api/books/${books[0].id}/reserve`, null, token)).status, 409);
});

test('dars qoldirilsa SMS navbatga tushadi', async () => {
  const { data: { token: admin } } = await call('POST', '/api/login', { login: 'admin', password: 'admin123' });
  const { data: { lessons } } = await call('GET', '/api/admin/lessons?date=2026-11-02', null, admin);
  const lesson = lessons[0];
  const { data: { students } } = await call('GET', `/api/admin/attendance?lessonId=${lesson.id}&date=2026-11-02`, null, admin);
  const r = await call('POST', '/api/admin/attendance', { lessonId: lesson.id, date: '2026-11-02', records: [{ studentId: students[0].id, status: 'absent' }, { studentId: students[1].id, status: 'present' }] }, admin);
  assert.equal(r.data.smsQueued, 1);
  const again = await call('POST', '/api/admin/attendance', { lessonId: lesson.id, date: '2026-11-02', records: [{ studentId: students[0].id, status: 'absent' }] }, admin);
  assert.equal(again.data.smsQueued, 0); // takroriy SMS yo'q
  await new Promise(r => setTimeout(r, 100));
  const { data: { items } } = await call('GET', '/api/admin/sms', null, admin);
  assert.ok(items.some(s => s.kind === 'absence' && s.status === 'sent'));
});
