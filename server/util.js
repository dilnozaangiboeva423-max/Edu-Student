const cfg = require('./config');
const DOW = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

function nowLocal(d = new Date()) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: cfg.tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' })
    .formatToParts(d).reduce((a, x) => (a[x.type] = x.value, a), {});
  return { date: `${p.year}-${p.month}-${p.day}`, dow: DOW[p.weekday], hhmm: `${p.hour}:${p.minute}` };
}
const dowOf = date => { const n = new Date(date + 'T00:00:00Z').getUTCDay(); return n === 0 ? 7 : n; };
const addDays = (date, n) => new Date(new Date(date + 'T00:00:00Z').getTime() + n * 864e5).toISOString().slice(0, 10);
const toMin = hhmm => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const httpErr = (status, message) => Object.assign(new Error(message), { status });
const validDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !isNaN(new Date(s));

module.exports = { nowLocal, dowOf, addDays, toMin, httpErr, validDate };
