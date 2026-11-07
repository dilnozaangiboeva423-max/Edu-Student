# EduBot — talabalar uchun 24/7 yordamchi

Investorlar taqdimotidagi g‘oyaning ishlaydigan versiyasi (MVP): veb-sayt + telefon (PWA) + AI yordamchi + SMS ogohlantirish.

## Imkoniyatlar
| Bo‘lim | Nima qiladi |
|---|---|
| **Bugun** | Hozirgi dars va keyingi darsgacha vaqt (jonli hisoblagich), bugungi darslar va davomat |
| **Dars jadvali** | Haftalik jadval. **Internet bo‘lmasa ham** oxirgi saqlangan jadval ko‘rinadi (PWA keshi) |
| **Kutubxona** | Katalog qidiruvi, nusxalar soni, oldindan bron qilish |
| **EduBot AI** | 24/7 savol-javob, javob **manba bilan** (ma’ruza/slayd). Jadval va kitob savollarini ham tushunadi |
| **SMS: dars qoldirildi** | Admin/o‘qituvchi davomatda "Kelmadi" belgilasa, talabaga avtomatik SMS ketadi |
| **Monitoring** | Universitet sayti, LMS, kutubxona va internet tekshiriladi. Xizmat 3 daqiqadan ortiq ishlamasa, adminlarga SMS |
| **Admin panel** | Davomat, bilim bazasi (AI materiallari), dars/kitob qo‘shish, monitoring, SMS jurnali |

**SMS navbati:** internet uzilib qolsa xabar yo‘qolmaydi — navbatda saqlanadi va aloqa tiklanishi bilan avtomatik yuboriladi (30 martagacha qayta urinadi).

## Ishga tushirish (WebStorm yoki IntelliJ IDEA)
1. **Node.js 20+** o‘rnating (https://nodejs.org). Hech qanday `npm install` kerak emas — loyiha tashqi kutubxonasiz ishlaydi.
2. IDE da **File → Open** va `edubot` papkasini tanlang.
   - WebStorm: tayyor.
   - IntelliJ IDEA: **Ultimate** versiya va *Node.js* plagini kerak (Settings → Plugins).
3. `.env.example` faylidan nusxa oling va nomini `.env` qiling.
4. Yuqori o‘ngdagi run-konfiguratsiyalardan **EduBot start** ni tanlab ▶ bosing (yoki terminalda `npm start`).
   Agar ko‘rinmasa: Run → Edit Configurations → + → **npm** → Command: `run`, Scripts: `start`.
5. Brauzerda oching: **http://localhost:3000**

Demo kirish: talaba `s1001` / `talaba123` · admin `admin` / `admin123`

Testlar: `npm test` (yoki IDE da `test/api.test.js` ni ▶).

## Haqiqiy SMS (Eskiz.uz)
`.env` da:
```
SMS_PROVIDER=eskiz
ESKIZ_EMAIL=sizning@emailingiz
ESKIZ_PASSWORD=parol
ESKIZ_FROM=4546
ADMIN_PHONES=998901234567
```
`SMS_PROVIDER=console` bo‘lsa SMS faqat server terminaliga yoziladi (sinov uchun). Admin panel → **SMS** bo‘limidan sinov xabari yuborib tekshiring.
SMS matnlari Eskiz moderatsiyasidan o‘tishi kerak; API so‘rovlari Eskiz hujjatlari bilan tekshirilsin (`server/sms.js`).

## Haqiqiy AI (Claude)
`.env` ga `ANTHROPIC_API_KEY=...` yozing. Kalit bo‘lmasa ham bot ishlaydi — bilim bazasidan qidirib, manba bilan javob qaytaradi. Kalit bo‘lsa, topilgan materiallar asosida Claude tushunarli javob yozadi. Bepul limit: kuniga 10 savol (`AI_DAILY_LIMIT`).

## Monitoring
Admin panel → **Monitoring** da o‘z xizmatlaringiz manzilini (LMS, sayt, kutubxona) qo‘shing. Demo uchun `example.com` kabi manzillar qo‘yilgan — ularni o‘chiring.

## Telefonga o‘rnatish
Saytni telefon brauzerida oching → "Bosh ekranga qo‘shish". Ilova oflayn ham ochiladi.
(Brauzer xavfsizlik qoidasiga ko‘ra, PWA oflayn ishlashi uchun sayt **HTTPS** da bo‘lishi kerak; `localhost` istisno.)

## Tuzilma
```
server/   index.js (API) · ai.js · sms.js · monitor.js · db.js · auth.js · seed.js
public/   index.html · css/app.css · js/app.js · sw.js (oflayn) · manifest
test/     api.test.js
data/     db.json (avtomatik yaratiladi)
```

## Ishlab chiqarishga chiqarishdan oldin
- `.env` da `APP_SECRET` ni uzun tasodifiy qiymatga almashtiring, `DEMO_HINT=false` qiling.
- Demo foydalanuvchilar parollarini o‘zgartiring/o‘chiring (`server/seed.js`), haqiqiy talabalar ro‘yxatini kiriting.
- Namuna materiallar (kutubxona ish vaqti, tartib qoidalari) o‘zingizning ma’lumotingizga almashtirilsin.
- Ma’lumotlar bazasi JSON fayl — pilot (bitta universitet) uchun yetarli. Ko‘p foydalanuvchida PostgreSQL ga o‘ting (`server/db.js` ni almashtirish kifoya).
- Serverni HTTPS ortida (Nginx/Caddy) va doimiy ishlaydigan holatda (pm2/systemd) ishga tushiring.
"# Edu-Student" 
