# Workflow Engine

Bu modul — HR Orbit'ning yuragi. Istalgan ariza turini (ta'til, ma'lumotnoma,
xodimni ko'chirish va h.k.) kod yozmasdan, konstruktor orqali sozlash va
ishga tushirish imkonini beradi.

## Ikki qatlam

1. **Konstruktor** (`template.service.ts`) — HR/Admin "Mehnat ta'tiliga chiqish
   arizasi" kabi yangi shablon yaratadi: forma maydonlari (`formSchema`),
   hujjat matni shabloni (`documentBody`, `{{maydon}}` bilan) va tasdiqlash
   zanjiri (`steps`, tartib bo'yicha).

2. **Ijro** (`instance.service.ts`) — xodim shablon asosida ariza yuboradi:
   - `createInstance` — forma tekshiriladi, hujjat generatsiya qilinadi,
     zanjirdagi HAR BIR bosqich uchun oldindan `WorkflowStepAction(PENDING)`
     yaratiladi va ijrochi (`assignedUserId`) hisoblanadi.
   - `decideStep` — joriy bosqichdagi odam tasdiqlasa, navbat avtomatik
     keyingi bosqichga o'tadi; rad etsa, butun zanjir to'xtaydi.
   - `getInstanceById` — `timeline` maydonini qaytaradi: har bir bosqich
     nomi, holati, kim ijrochi, qachon harakat qilingan — **kuzatuv ekrani**
     shu bitta obyektdan quriladi, xodim ham HR ham shu yerdan foydalanadi.

## Ijrochini aniqlash qoidalari (`ApproverType`)

| Turi | Qanday ishlaydi |
|---|---|
| `SPECIFIC_USER` | Zanjir qurilganda aniq shaxs belgilanadi (masalan "Yurist — Jasur") |
| `ROLE` | Tashkilotdagi shu roldagi birinchi faol foydalanuvchi (masalan `HR_MANAGER`) |
| `DIRECT_MANAGER` | Arizachining `Employee.managerId` orqali bevosita rahbari — **dinamik**, har bir xodim uchun avtomatik to'g'ri odam topiladi |
| `DEPARTMENT_HEAD` | Arizachi bo'limining `headEmployeeId` orqali boshlig'i |

`DIRECT_MANAGER` / `DEPARTMENT_HEAD` tufayli bitta shablon *barcha* xodimlar
uchun ishlaydi — har bir xodim uchun alohida zanjir yozish shart emas.

## Misol: Mehnat ta'tiliga chiqish arizasi

`prisma/seed.ts` faylida to'liq misol bor — foydalanuvchi so'ragan aynan shu
senariy: **Xodim → Bo'lim boshlig'i → Kadrlar → Yurist → Rahbar**.

```
POST /api/workflow/instances
{
  "templateId": "...",
  "employeeId": "...",
  "formData": { "startDate": "2026-10-01", "endDate": "2026-10-15", "daysCount": 15 }
}
```

Javobda `timeline` massivi keladi — frontendda progress-bar/stepper sifatida
chiziladi:

```
[
  { order: 1, stepName: "Bo'lim boshlig'i tasdig'i", status: "APPROVED", ... },
  { order: 2, stepName: "Kadrlar bo'limi tekshiruvi", status: "PENDING", isCurrent: true, ... },
  { order: 3, stepName: "Yurist tasdig'i", status: "PENDING", ... },
  { order: 4, stepName: "Rahbar imzosi", status: "PENDING", ... }
]
```

## Kengaytirish g'oyalari (keyingi bosqich)

- **Shartli tarmoqlanish**: masalan "agar kun soni 14 dan ko'p bo'lsa —
  qo'shimcha bosqich qo'shilsin". Hozirgi modelda `WorkflowStep` chiziqli
  zanjir; buni qo'llab-quvvatlash uchun `condition: Json` maydoni va
  ijro vaqtida shu shartni tekshiruvchi logika qo'shiladi.
- **Eskalatsiya**: bosqich N kun javobsiz qolsa, avtomatik eslatma yoki
  keyingi ishtirokchiga o'tkazish — BullMQ orqali fon vazifasi sifatida.
- **Parallel tasdiqlash**: bir bosqichda bir nechta kishi bir vaqtda
  tasdiqlashi kerak bo'lsa (`order` bir xil bo'lgan bir nechta step).
