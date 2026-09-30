# Byapar ERP — Stock, Billing & Manufacturing (Client Demo)

Interactive demo of a business management system for **ABC Manufacturing & Trading Pvt. Ltd.**:
parties, sales/POS billing, invoices, purchase, inventory, manufacturing (BOM + production),
payments, expenses, reports and settings. All amounts are in NPR with Nepali digit grouping (2,45,800) and 13% VAT.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
# or a production build
npm run build && npm start
```

Demo data is generated on first load and saved in the browser (localStorage).
Dates shift automatically so "today" always has activity. Use **Settings → Reset Demo Data**
(or the user menu) to start fresh before a presentation.

## Suggested demo script (≈10 min)

1. **Dashboard** — today's sales/purchase, receivable NPR 4,85,000, payable NPR 2,35,000, stock value, low-stock alerts, charts.
2. **Parties → Everest Hardware Store** — overview, ledger (Dr/Cr running balance), payments, sales tabs.
3. **New Sale** (from the profile) — add Cement + Steel, change qty, discount, VAT; pick *Cash* and enter a partial amount → **Save**.
4. The **invoice** opens — Tax Invoice with amount in words, Print / PDF / Share.
5. **Record Payment** on the invoice → remaining due updates; party balance updates.
6. **Products → Cement** (or Inventory) — stock reduced, stock history shows the sale.
7. **Parties → Himalayan Suppliers → New Purchase** — add Cement 200 BAG → Save → stock increased.
8. **Manufacturing → Bill of Materials** — Product A recipe with estimated cost & margin → **Produce**.
9. Enter quantity → **Complete Production** → Stock Impact shows raw materials decreasing and finished goods increasing.
10. **Reports** — Sales (daily/weekly/monthly, by product/customer), Purchase, Profit & Loss with VAT summary,
    Stock, Stock Valuation, Party Outstanding (aging), Customer/Supplier Statement. Every report has filters, search, Export (CSV/Excel) and Print.

Also try: **Ctrl + K** global search, **Quick Add** menu, notifications bell, Stock Adjustment (physical count), Expenses, Settings → Users / Invoice settings.

## Tech

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · shadcn/ui (Base UI) · Lucide · Recharts · Zustand.

## Code map

| Path | What |
| --- | --- |
| `src/lib/types.ts` | Domain types (mirror future DB tables) |
| `src/lib/seed.ts` | Realistic demo data generator |
| `src/lib/store.ts` | All business actions (sale, purchase, payment, stock, production…) — swap for API calls later |
| `src/lib/ledger.ts` | Pure calculations: balances, stock, ledgers, FIFO payment allocation |
| `src/components/shared/*` | Reusable DataTable, filters, pickers, charts, invoice & statement documents, dialogs |
| `src/components/dialogs/global-dialogs.tsx` | Party, product, payment, stock, expense and BOM forms |
| `src/components/reports/*` | Report views |
| `src/app/*` | Pages / routes |

## Moving to production

Replace the Zustand actions in `src/lib/store.ts` with API routes / server actions backed by PostgreSQL (Supabase),
keeping `ledger.ts` logic on the server. Add authentication and role permissions (Admin / Accountant / Staff),
Nepali (BS) date support, IRD-compliant invoice numbering per fiscal year, and PDF generation.
