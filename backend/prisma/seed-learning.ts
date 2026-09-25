// Learning & Development uchun namunaviy katalog: materiallar, tadbirlar
// va demo xodimlar uchun boshlang'ich progress/tayinlash/maqsad.
// Admin qismi (kurs/material yaratish) qurilgunga qadar xodim sahifasi
// bo'sh ko'rinmasligi uchun.
//
// Idempotent: tashkilotda allaqachon material bo'lsa — o'tkazib yuboriladi.
// Mustaqil ishga tushirish: `npm run prisma:seed:learning`
import { PrismaClient, type LearningMaterial, type LearningMaterialType } from '@prisma/client';

interface MaterialSeed {
  title: string;
  description: string;
  type: LearningMaterialType;
  durationMinutes: number;
  author: string;
  tags: string[];
  contentUrl: string;
  requiresApproval?: boolean;
  daysAgo: number;
}

const MATERIALS: MaterialSeed[] = [
  {
    title: 'Menejment formulasi',
    description: "Jamoani boshqarish, maqsad qo'yish va natijani nazorat qilishning asosiy tamoyillari.",
    type: 'VIDEO',
    durationMinutes: 180,
    author: 'HR Orbit akademiyasi',
    tags: ['menejment', 'liderlik'],
    contentUrl: 'https://www.youtube.com/results?search_query=management+fundamentals',
    daysAgo: 2,
  },
  {
    title: 'Menejment formulasi: qisqa audio',
    description: 'Yo‘lda tinglash uchun menejment asoslari bo‘yicha qisqa audio dars.',
    type: 'AUDIO',
    durationMinutes: 13,
    author: 'HR Orbit akademiyasi',
    tags: ['menejment', 'audio'],
    contentUrl: 'https://www.youtube.com/results?search_query=management+podcast',
    daysAgo: 1,
  },
  {
    title: 'Mijozni ishlab chiqish jarayoniga jalb qiling',
    description: 'Mahsulotni mijoz bilan birga yaratish: intervyu, prototip va tezkor fikr-mulohaza.',
    type: 'BOOK',
    durationMinutes: 180,
    author: 'Stiv Blank',
    tags: ['mahsulot', 'mijoz'],
    contentUrl: 'https://en.wikipedia.org/wiki/Customer_development',
    daysAgo: 5,
  },
  {
    title: 'Inson va biznes rivoji uchun muhit arxitekturasi',
    description: "Tashkilot ichida o'rganish va rivojlanishni qo'llab-quvvatlovchi muhitni qanday qurish kerak.",
    type: 'COURSE',
    durationMinutes: 180,
    author: 'HR Orbit akademiyasi',
    tags: ['tashkilot', 'rivojlanish'],
    contentUrl: 'https://en.wikipedia.org/wiki/Learning_organization',
    daysAgo: 9,
  },
  {
    title: '21-asrda mijozga yo‘naltirilgan raqamli mahsulot dizayni',
    description: 'Raqamli mahsulotlarni foydalanuvchi ehtiyojidan kelib chiqib loyihalash.',
    type: 'VIDEO',
    durationMinutes: 180,
    author: 'Dizayn maktabi',
    tags: ['dizayn', 'ux'],
    contentUrl: 'https://www.youtube.com/results?search_query=customer+centric+product+design',
    daysAgo: 12,
  },
  {
    title: 'Tashqi kutubxonalarni boshqarish',
    description: 'Dasturiy loyihalarda tashqi kutubxonalarni tanlash, yangilash va xavfsizligini nazorat qilish.',
    type: 'ARTICLE',
    durationMinutes: 15,
    author: 'IT bo‘limi',
    tags: ['dasturlash', 'xavfsizlik'],
    contentUrl: 'https://en.wikipedia.org/wiki/Software_supply_chain',
    daysAgo: 3,
  },
  {
    title: 'To‘lqin ustida: texnologiya, hokimiyat va buyuk dilemma',
    description: "Sun'iy intellekt va yangi texnologiyalarning jamiyatga ta'siri haqida kitob.",
    type: 'BOOK',
    durationMinutes: 420,
    author: 'Mustafo Sulaymon',
    tags: ['texnologiya', 'ai'],
    contentUrl: 'https://en.wikipedia.org/wiki/The_Coming_Wave',
    daysAgo: 4,
  },
  {
    title: 'Samarali muzokara olib borish',
    description: "Muzokaraga tayyorlanish, manfaatlarni aniqlash va g'alaba-g'alaba yechim topish.",
    type: 'COURSE',
    durationMinutes: 240,
    author: 'Biznes maktabi',
    tags: ['muloqot', 'sotuv'],
    contentUrl: 'https://en.wikipedia.org/wiki/Negotiation',
    requiresApproval: true,
    daysAgo: 6,
  },
  {
    title: 'Vaqtni boshqarish: 5 ta amaliy usul',
    description: 'Pomodoro, Eyzenxauer matritsasi va boshqa usullar bilan kunni rejalashtirish.',
    type: 'ARTICLE',
    durationMinutes: 10,
    author: 'HR bo‘limi',
    tags: ['samaradorlik'],
    contentUrl: 'https://en.wikipedia.org/wiki/Time_management',
    daysAgo: 7,
  },
  {
    title: 'Hissiy intellekt ish joyida',
    description: "O'z his-tuyg'ularini boshqarish va hamkasblar bilan samarali munosabat qurish.",
    type: 'AUDIO',
    durationMinutes: 45,
    author: 'Psixologiya markazi',
    tags: ['soft skills', 'liderlik'],
    contentUrl: 'https://en.wikipedia.org/wiki/Emotional_intelligence',
    daysAgo: 8,
  },
  {
    title: 'Excel: moliyaviy tahlil asoslari',
    description: 'Jadval, formulalar va pivot jadvallar yordamida moliyaviy hisobotlarni tahlil qilish.',
    type: 'COURSE',
    durationMinutes: 300,
    author: 'Moliya bo‘limi',
    tags: ['excel', 'moliya'],
    contentUrl: 'https://www.youtube.com/results?search_query=excel+financial+analysis',
    daysAgo: 10,
  },
  {
    title: 'Axborot xavfsizligi: har bir xodim bilishi shart',
    description: 'Fishing, parollar va maxfiy ma’lumotlar bilan ishlash qoidalari. Barcha xodimlar uchun majburiy.',
    type: 'VIDEO',
    durationMinutes: 30,
    author: 'IT bo‘limi',
    tags: ['xavfsizlik', 'majburiy'],
    contentUrl: 'https://www.youtube.com/results?search_query=information+security+awareness+training',
    daysAgo: 14,
  },
];

function daysFromNow(days: number, hour = 10) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hour - 5, 0, 0, 0); // Toshkent vaqti (UTC+5)
  return d;
}

export async function seedLearning(prisma: PrismaClient, organizationId: string) {
  const existing = await prisma.learningMaterial.count({ where: { organizationId } });
  if (existing > 0) {
    console.log(`Learning: tashkilotda ${existing} ta material bor — o'tkazib yuborildi`);
    return;
  }

  const materials: LearningMaterial[] = [];
  for (const m of MATERIALS) {
    const { daysAgo, ...data } = m;
    materials.push(
      await prisma.learningMaterial.create({
        data: { ...data, organizationId, publishedAt: daysFromNow(-daysAgo) },
      }),
    );
  }
  const byTitle = (title: string) => materials.find((m) => m.title === title)!;

  await prisma.learningEvent.createMany({
    data: [
      {
        organizationId,
        title: 'Liderlik bo‘yicha amaliy trening',
        description: "Yangi rahbarlar uchun ikki kunlik amaliy trening: jamoa bilan ishlash, fikr-mulohaza berish.",
        format: 'OFFLINE',
        location: 'Toshkent bosh ofis, 3-qavat konferens-zal',
        speaker: 'Dilnoza Qosimova',
        startsAt: daysFromNow(5, 10),
        endsAt: daysFromNow(5, 17),
        capacity: 20,
        requiresApproval: true,
      },
      {
        organizationId,
        title: 'Vebinar: sun’iy intellekt kundalik ishda',
        description: "ChatGPT va boshqa AI vositalaridan xavfsiz va samarali foydalanish.",
        format: 'ONLINE',
        meetingUrl: 'https://meet.google.com/',
        speaker: 'Olim Boshliqov',
        startsAt: daysFromNow(2, 15),
        endsAt: daysFromNow(2, 16),
      },
      {
        organizationId,
        title: 'Kitob klubi: “To‘lqin ustida”',
        description: 'Oyning kitobini birga muhokama qilamiz. Choy va pechenye bizdan.',
        format: 'OFFLINE',
        location: 'Kutubxona xonasi',
        startsAt: daysFromNow(9, 18),
        endsAt: daysFromNow(9, 19),
        capacity: 15,
      },
      {
        organizationId,
        title: 'Axborot xavfsizligi bo‘yicha yillik instruktaj',
        description: 'Barcha xodimlar uchun majburiy onlayn instruktaj.',
        format: 'ONLINE',
        meetingUrl: 'https://meet.google.com/',
        speaker: 'IT bo‘limi',
        startsAt: daysFromNow(14, 11),
        endsAt: daysFromNow(14, 12),
      },
      {
        organizationId,
        title: 'Muzokara san’ati: master-klass',
        description: "Sotuv va xarid bo'limlari uchun master-klass.",
        format: 'OFFLINE',
        location: 'Toshkent bosh ofis, 2-qavat',
        speaker: 'Bahodir Nematov',
        startsAt: daysFromNow(-7, 14),
        endsAt: daysFromNow(-7, 17),
      },
    ],
  });

  // Demo xodim (xodim@demo.uz) va boshqalar uchun boshlang'ich holat —
  // "Davom ettirish", "Tayinlangan" va "Tarix" tablari bo'sh bo'lmasligi uchun.
  const demoUsers = await prisma.user.findMany({
    where: { organizationId, email: { in: ['xodim@demo.uz', 'boshliq@demo.uz', 'hr@demo.uz', 'tabelchi@demo.uz'] } },
    select: { id: true, employee: { select: { id: true } } },
  });
  const hrUser = await prisma.user.findFirst({ where: { organizationId, email: 'hr@demo.uz' }, select: { id: true } });

  const inProgress: [string, number][] = [
    ['Inson va biznes rivoji uchun muhit arxitekturasi', 24],
    ['Mijozni ishlab chiqish jarayoniga jalb qiling', 72],
    ['Menejment formulasi', 5],
    ['21-asrda mijozga yo‘naltirilgan raqamli mahsulot dizayni', 48],
  ];

  for (const user of demoUsers) {
    const employeeId = user.employee?.id;
    if (!employeeId) continue;

    for (const [title, progress] of inProgress) {
      await prisma.learningProgress.create({
        data: {
          organizationId,
          employeeId,
          materialId: byTitle(title).id,
          progress,
          startedAt: daysFromNow(-10),
          lastOpenedAt: daysFromNow(-Math.round(progress / 20)),
        },
      });
    }
    await prisma.learningProgress.create({
      data: {
        organizationId,
        employeeId,
        materialId: byTitle('Vaqtni boshqarish: 5 ta amaliy usul').id,
        progress: 100,
        status: 'COMPLETED',
        startedAt: daysFromNow(-6),
        lastOpenedAt: daysFromNow(-5),
        completedAt: daysFromNow(-5),
      },
    });

    await prisma.learningAssignment.createMany({
      data: [
        {
          organizationId,
          employeeId,
          materialId: byTitle('Axborot xavfsizligi: har bir xodim bilishi shart').id,
          assignedByUserId: hrUser?.id,
          dueDate: daysFromNow(10),
          note: 'Barcha xodimlar uchun majburiy',
        },
        {
          organizationId,
          employeeId,
          materialId: byTitle('Excel: moliyaviy tahlil asoslari').id,
          assignedByUserId: hrUser?.id,
          dueDate: daysFromNow(30),
        },
      ],
    });

    await prisma.learningFavorite.createMany({
      data: [
        { organizationId, employeeId, materialId: byTitle('To‘lqin ustida: texnologiya, hokimiyat va buyuk dilemma').id },
        { organizationId, employeeId, materialId: byTitle('Hissiy intellekt ish joyida').id },
      ],
    });

    await prisma.developmentGoal.create({
      data: {
        organizationId,
        employeeId,
        title: 'Jamoa rahbari bo‘lishga tayyorlanish',
        description: "Yil oxirigacha liderlik va menejment bo'yicha asosiy materiallarni o'zlashtirish.",
        dueDate: daysFromNow(90),
        materials: {
          create: [
            { materialId: byTitle('Menejment formulasi').id },
            { materialId: byTitle('Hissiy intellekt ish joyida').id },
            { materialId: byTitle('Vaqtni boshqarish: 5 ta amaliy usul').id },
          ],
        },
      },
    });
  }

  console.log(`Learning: ${materials.length} ta material, 5 ta tadbir, ${demoUsers.length} ta demo xodim uchun progress yaratildi`);
}

// Mustaqil ishga tushirilganda — barcha tashkilotlar uchun
if (process.argv[1]?.includes('seed-learning')) {
  const prisma = new PrismaClient();
  prisma.organization
    .findMany({ select: { id: true, name: true } })
    .then(async (orgs) => {
      for (const org of orgs) {
        console.log(`Tashkilot: ${org.name}`);
        await seedLearning(prisma, org.id);
      }
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
