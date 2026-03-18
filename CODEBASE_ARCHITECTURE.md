# SYSTEM OVERVIEW
- Uygulaman�n amac�: Y�ll�k b�t�e planlama, i�lemler, bor� planlama, hesap/net de�er takibi ve 50/30/20 analizi.
- Tech stack: React 18 + Vite + TypeScript, Tailwind, Radix/shadcn UI, Recharts.
- State management: React Context (`BudgetContext`).
- Persistence: `localStorage` (`budgetPlannerData`) + schema versioning/migration.
- Routing: `react-router`.
- i18n: Basit `t()` + locale yard�mc�lar� (`i18n.ts`).
- Import/export: CSV export + Excel import (xlsx) Transaction Log �zerinden.
- Formatting/localization: `formatCurrency` helper, locale-aware separators, TL deste�i.

# CURRENT FOLDER STRUCTURE
- `src/app/types.ts`
- `src/app/context/BudgetContext.tsx`
- `src/app/utils/*`
- `src/app/pages/*`
- `src/app/components/*`

# DATA MODELS
- Settings: `currency`, `startMonth`, `startYear`, `budgetMethod`, `familyMembers`, `language`.
- Category: `id`, `name`, `type`, `classification`, `color?`.
- Transaction: `id`, `date`, `amount`, `categoryId`, `accountId?`, `debtId?`, `installmentId?`, `description`, `type`, `spender?`.
- Account: `id`, `name`, `type`, `openingBalance`, `currentBalance`, `isAsset`, `currency?`, `isForeignCurrency?`, `exchangeRate?`, `notes?`.
- Debt: `id`, `name`, `totalAmount`, `currentBalance`, `interestRate`, `minimumPayment`, `accountId?`, `paymentCategoryId?`, `installmentStartDate?`, `installmentFrequency?`, `installmentCount?`, `installmentAmount?`, `installments?`.
- SavingsGoal: `id`, `name`, `targetAmount`, `currentAmount`, `targetDate?`, `accountId?`.

# IMPORTANT FEATURES
- Setup: Ayarlar + kategori y�netimi + s�n�fland�rma (Needs/Wants/Savings) + dil se�imi.
- Transaction Log: CRUD, filtreler, arama, export CSV, Excel import (�nizleme + onay).
- Debt Planner: Bor� stratejisi + taksit plan� (utils�e ta��nm��).
- Accounts & Wealth: Net worth, hesaplar, hedefler.
- Annual Dashboard: Y�ll�k metrikler, grafikler, y�l filtresi.
- Monthly Overview: Ayl�k g�r�n�m ve grafikler.
- Import flow: Excel import � �nizleme � onay � append + otomatik kategori/hesap/ki�iler.
- Classification / 50/30/20: Kategori `classification` alan� ile.
- Localization: EN/TR, ay/g�n adlar�, tarih format�, para format�.

# RECENT CHANGES
- Eklenen yeni alanlar: `Settings.language`, `Category.classification`, `Transaction.debtId/installmentId`, `Account.currency/isForeignCurrency/exchangeRate/notes`, `Debt.installment*`.
- Yeni helper dosyalar�: `utils/i18n.ts`, `utils/id.ts`, `utils/formatting.ts`, `utils/categoryColors.ts`.
- Yeni filtreler: Transaction Log tarih presetleri + pagination + arama + date range.
- Sidebar / navigation de�i�iklikleri: Top bar � collapsible sidebar, MUI ikonlar�, header toggle, `overflow-x-hidden`.
- Import �zellikleri: Excel import (xlsx), header tolerans�, typo destek, preview dialog, append.
- Formatting / locale de�i�iklikleri: `formatCurrency` (binlik ay�r�c�, b�y�k de�erlerde decimals yok), TR locale.

# KNOWN RISKS / OPEN QUESTIONS
- currentBalance stored m� derived m�? �u an UI�da transactionlardan t�retiliyor; persisted alan h�l� var.
- normalization yeterli mi? Temel normalizasyon var; yeni alanlar i�in dikkatli.
- duplicated logic var m�? Baz� formatlama/label tekrarlar� var; hesaplama helpers k�sm� k�smen merkezi.
- performance pain point var m�? B�y�k transaction listelerinde filtre/pagination client-side olabilir.
- localStorage migration var m�? Var (schemaVersion, geri uyum).
