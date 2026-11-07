// Oddiy fayl asosidagi ma'lumotlar bazasi (JSON). Atomik yozish: tmp -> rename.
const fs = require('fs');
const path = require('path');
const cfg = require('./config');

let data = null, timer = null;
const empty = () => ({ seq: 1000, users: [], lessons: [], attendance: [], books: [], reservations: [], knowledge: [], sms: [], services: [], chats: [], usage: [] });

function load() {
  fs.mkdirSync(path.dirname(cfg.dataFile), { recursive: true });
  if (fs.existsSync(cfg.dataFile)) { data = { ...empty(), ...JSON.parse(fs.readFileSync(cfg.dataFile, 'utf8')) }; return false; }
  data = empty();
  return true; // yangi baza
}
function flush() { clearTimeout(timer); const tmp = cfg.dataFile + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(data, null, 1)); fs.renameSync(tmp, cfg.dataFile); }
function save() { clearTimeout(timer); timer = setTimeout(flush, 150); }
process.on('exit', () => { if (data) try { flush(); } catch {} });

module.exports = { load, save, flush, db: () => data, nextId: () => ++data.seq };
