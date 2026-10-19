# HR Orbit

Multi-tenant HR SaaS platformasi. To'liq rejani [loyihalash hujjatida](https://claude.ai/code/artifact/84b34f20-3781-4436-9f17-da5337201e9b) ko'ring.

## Tuzilma

```
HR platforma/
├── backend/          Node.js + Express + TypeScript + Prisma (PostgreSQL)
└── frontend/          Next.js + TypeScript (keyingi bosqichda)
```

## Demo rejim (backendsiz UI)

Frontend standart holatda **demo rejimda** ishlaydi: backend va Supabase kerak emas.
Barcha API so'rovlari brauzer ichidagi mock API'ga (`frontend/src/mock/`) yo'naltiriladi,
ma'lumotlar `localStorage`'da saqlanadi va backend seed'iga mos boshlang'ich ma'lumotlar bilan to'ldiriladi
(28 xodim, 5 bo'lim, 2 oylik davomat, arizalar, L&D materiallari).

- Kirish: `demo` tashkiloti, istalgan demo hisob (`hr@demo.uz`, `xodim@demo.uz`, ...), parol `Password123!`
- Ma'lumotlarni qayta tiklash: profil menyusi → "Demo ma'lumotlarni tiklash"
- Haqiqiy backendga qaytish: Vercel'da `NEXT_PUBLIC_DEMO_MODE=false` qo'ying
- Mock API tekshiruvi: `cd frontend && npx tsx scripts/demo-smoke.ts`

## Ishga tushirish (backend)

```bash
cd backend
cp .env.example .env      # DATABASE_URL va JWT sirlarini to'ldiring
npm install
npm run prisma:migrate     # DB sxemasini yaratish
npm run prisma:seed        # boshlang'ich test ma'lumotlari
npm run dev                # http://localhost:4000
```

## Arxitektura asoslari

- **Multi-tenant**: har bir jadval `organizationId` orqali ajratiladi; har bir so'rov `tenant` middleware'idan o'tadi.
- **RBAC**: rol-asoslangan ruxsatlar, `requireRole()` middleware orqali.
- **Workflow Engine**: konstruktor orqali istalgan hujjat aylanish jarayonini (ariza → zanjir bo'yicha tasdiqlash → yakunlanish) sozlash va ishga tushirish mumkin. Batafsil: [backend/src/modules/workflow/README.md](backend/src/modules/workflow/README.md).

## Modullar bosqichlari

| Faza | Modullar |
|---|---|
| 1 — Fundament | Auth, Core HR, Tashkiliy tuzilma, Dashboard, Admin panel |
| 2 — O'sish | **Workflow konstruktori**, Recruiter (ATS), KPI, Training, Test/Opros |
| 3 — Chuqurlashtirish | E-IMZO integratsiyasi, Telegram bot, hisobotlar |
