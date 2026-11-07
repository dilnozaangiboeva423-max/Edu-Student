const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

// .env faylini o'qish (tashqi kutubxonasiz)
const envFile = path.join(root, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const e = process.env;
module.exports = {
  root,
  port: +e.PORT || 3000,
  tz: e.TZ_NAME || 'Asia/Tashkent',
  secret: e.APP_SECRET || 'dev-secret-change-me',
  demoHint: (e.DEMO_HINT || 'true') === 'true',
  dataFile: path.isAbsolute(e.DATA_FILE || '') ? e.DATA_FILE : path.join(root, e.DATA_FILE || 'data/db.json'),
  sms: { provider: e.SMS_PROVIDER || 'console', email: e.ESKIZ_EMAIL || '', password: e.ESKIZ_PASSWORD || '', from: e.ESKIZ_FROM || '4546' },
  ai: { key: e.ANTHROPIC_API_KEY || '', model: e.ANTHROPIC_MODEL || 'claude-sonnet-5-5', dailyLimit: +e.AI_DAILY_LIMIT || 10 },
  monitor: {
    intervalSec: +e.MONITOR_INTERVAL_SEC || 60,
    downMinutes: e.MONITOR_DOWN_MINUTES === undefined ? 3 : +e.MONITOR_DOWN_MINUTES,
    internetUrl: e.INTERNET_CHECK_URL || 'https://www.gstatic.com/generate_204',
    adminPhones: (e.ADMIN_PHONES || '').split(',').map(s => s.trim()).filter(Boolean),
  },
};
