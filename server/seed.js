// Demo ma'lumotlar. Birinchi ishga tushishda bir marta yoziladi.
const { db, nextId, save } = require('./db');
const { hash } = require('./auth');
const monitor = require('./monitor');
const cfg = require('./config');

module.exports = function seed() {
  const D = db();
  const user = (o) => D.users.push({ id: nextId(), ...o, pass: hash(o.pass) });
  user({ name: 'Administrator', login: 'admin', pass: 'admin123', role: 'admin', phone: cfg.monitor.adminPhones[0] || '998901234567' });
  user({ name: 'Aziz Karimov', login: 's1001', pass: 'talaba123', role: 'student', group: 'DI-21', phone: '998901112233' });
  user({ name: 'Dilnoza Yusupova', login: 's1002', pass: 'talaba123', role: 'student', group: 'DI-21', phone: '998901112244' });
  user({ name: 'Jasur Rahimov', login: 's1003', pass: 'talaba123', role: 'student', group: 'DI-21', phone: '998901112255' });

  const T = [['08:30', '09:50'], ['10:00', '11:20'], ['11:30', '12:50'], ['14:00', '15:20']];
  const plan = {
    1: [['Ma’lumotlar bazalari', 'Q. Ergashev', '301', 0], ['Dasturlash asoslari', 'N. Saidova', '215', 1]],
    2: [['Matematik tahlil', 'B. Tursunov', '112', 0], ['Ma’lumotlar bazalari (amaliy)', 'Q. Ergashev', 'Lab-4', 1], ['Ingliz tili', 'M. Karimova', '208', 3]],
    3: [['Dasturlash asoslari', 'N. Saidova', '215', 0], ['Matematik tahlil', 'B. Tursunov', '112', 1]],
    4: [['Ma’lumotlar bazalari', 'Q. Ergashev', '301', 1], ['Jismoniy tarbiya', 'S. Aliyev', 'Zal', 2]],
    5: [['Dasturlash asoslari (amaliy)', 'N. Saidova', 'Lab-2', 0], ['Ingliz tili', 'M. Karimova', '208', 1]],
    6: [['Matematik tahlil (amaliy)', 'B. Tursunov', '112', 0]],
  };
  for (const [day, ls] of Object.entries(plan)) for (const [subject, teacher, room, ti] of ls)
    D.lessons.push({ id: nextId(), group: 'DI-21', day: +day, start: T[ti][0], end: T[ti][1], subject, teacher, room });

  const book = (title, author, subject, year, copies, location) => D.books.push({ id: nextId(), title, author, subject, year, copies, available: copies, location });
  book('Ma’lumotlar bazalari asoslari', 'K. Date', 'ma’lumotlar bazasi sql', 2019, 4, 'A-12 javon');
  book('SQL tili: boshlang‘ich kurs', 'A. Beaulieu', 'sql ma’lumotlar bazasi', 2020, 2, 'A-12 javon');
  book('Dasturlash asoslari (Python)', 'M. Lutz', 'dasturlash python', 2021, 5, 'B-03 javon');
  book('Algoritmlar va ma’lumotlar tuzilmasi', 'T. Cormen', 'algoritm dasturlash', 2018, 3, 'B-05 javon');
  book('Matematik tahlil asoslari', 'G. Fixtengols', 'matematika tahlil hosila limit', 2017, 6, 'C-01 javon');
  book('Oliy matematika', 'V. Minorskiy', 'matematika', 2016, 3, 'C-02 javon');
  book('English Grammar in Use', 'R. Murphy', 'ingliz tili grammatika', 2019, 8, 'D-07 javon');
  book('Axborot texnologiyalari', 'S. Rahmonqulova', 'informatika texnologiya', 2022, 4, 'B-09 javon');

  const kb = (title, subject, source, text) => D.knowledge.push({ id: nextId(), title, subject, source, text });
  kb('Normalizatsiya nima?', 'Ma’lumotlar bazalari', '4-ma’ruza, 12-slayd', 'Normalizatsiya — jadvallardagi takrorlanuvchi ma’lumotlarni kamaytirish usuli. Misol: har bir talaba qatorida guruh nomi qayta-qayta yozilsa, guruh nomini alohida "Guruhlar" jadvaliga chiqaramiz va talabalar jadvalida faqat guruh raqamini (kalitni) saqlaymiz. Natijada ma’lumot bir joyda saqlanadi va xatolik kamayadi.');
  kb('Birlamchi va tashqi kalit', 'Ma’lumotlar bazalari', '3-ma’ruza, 8-slayd', 'Birlamchi kalit (PRIMARY KEY) jadvaldagi har bir qatorni yagona aniqlaydi va takrorlanmaydi. Tashqi kalit (FOREIGN KEY) boshqa jadvalning birlamchi kaliti bilan bog‘lanadi. Misol: Talabalar jadvalidagi guruh_id — Guruhlar jadvalining id maydoniga tashqi kalit.');
  kb('SQL JOIN turlari', 'Ma’lumotlar bazalari', '6-ma’ruza, 5-slayd', 'JOIN ikki jadvalni bog‘laydi. INNER JOIN faqat ikkala jadvalda mos kelgan qatorlarni qaytaradi. LEFT JOIN chap jadvalning barcha qatorlarini, o‘ngdan mos kelganlarini qaytaradi (mos kelmasa NULL). Misol: SELECT t.ism, g.nomi FROM talabalar t INNER JOIN guruhlar g ON t.guruh_id = g.id;');
  kb('Sikl nima? for va while', 'Dasturlash asoslari', '5-ma’ruza, 3-slayd', 'Sikl — amalni bir necha marta takrorlash. for sikli takrorlar soni oldindan ma’lum bo‘lganda qulay: for i in range(5): print(i). while sikli shart to‘g‘ri bo‘lguncha davom etadi: while x < 10: x += 1. Cheksiz siklga tushmaslik uchun shart albatta o‘zgarishi kerak.');
  kb('Funksiya nima?', 'Dasturlash asoslari', '7-ma’ruza, 2-slayd', 'Funksiya — nom berilgan, qayta ishlatiladigan kod bloki. U kirish qiymatlari (parametrlar) qabul qiladi va natija qaytaradi. Misol: def kvadrat(x): return x * x. Chaqirish: kvadrat(4) natijasi 16.');
  kb('Hosila nima?', 'Matematik tahlil', '9-ma’ruza, 4-slayd', 'Hosila funksiyaning o‘zgarish tezligini ko‘rsatadi. f(x) = x² uchun hosila f’(x) = 2x. Geometrik ma’nosi: grafikka berilgan nuqtada o‘tkazilgan urinmaning qiyaligi. Misol: x = 3 nuqtada tezlik 2·3 = 6.');
  kb('Limit tushunchasi', 'Matematik tahlil', '6-ma’ruza, 7-slayd', 'Limit — x qiymati biror songa yaqinlashganda f(x) qaysi songa yaqinlashishini bildiradi. Misol: x nolga intilganda sin(x)/x ning limiti 1 ga teng.');
  kb('Kutubxona ish vaqti', 'Universitet', 'Kutubxona nizomi (namuna)', 'Kutubxona dushanbadan shanbagacha 09:00–18:00 da ochiq. Yakshanba dam olish kuni. Kitobni 14 kunga olish mumkin, bir marta 7 kunga uzaytiriladi. Elektron kutubxona 24/7 ishlaydi. (Bu namuna matn — o‘zingizning ma’lumotingizga almashtiring.)');
  kb('Dars qoldirilsa nima qilish kerak?', 'Universitet', 'Ichki tartib (namuna)', 'Dars qoldirilgan bo‘lsa, talabaga SMS xabar yuboriladi. Sababli bo‘lsa, 3 kun ichida dekanatga ma’lumotnoma topshiring. Qoldirilgan mavzuni o‘qituvchidan so‘rab, amaliy topshiriqni qayta topshirish mumkin. (Namuna matn.)');

  monitor.addService('EduBot serveri (o‘zi)', `http://localhost:${cfg.port}/api/health`);
  monitor.addService('Universitet veb-sayti', 'https://example.com');
  monitor.addService('LMS (dars materiallari)', 'https://example.org');
  monitor.addService('Elektron kutubxona', 'https://example.net');
  save();
};
