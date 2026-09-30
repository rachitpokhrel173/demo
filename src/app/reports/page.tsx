"use client"

import { Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { BarChart3, Boxes, Factory, FileText, Receipt, Scale, ShoppingCart, Truck, Users, Wallet, Warehouse, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { PageHeader } from "@/components/shared/ui-bits"
import { SimpleSelect } from "@/components/shared/filters"
import { ExpenseReport, PaymentReport, ProfitLossReport, SalesOrPurchaseReport } from "@/components/reports/financial-reports"
import { ManufacturingReport, OutstandingReport, StatementReport, StockReport, StockValuationReport } from "@/components/reports/stock-party-reports"

const REPORTS: { key: string; label: string; icon: LucideIcon; group: string; render: () => React.ReactNode }[] = [
  { key: "sales", label: "Sales Report", icon: ShoppingCart, group: "Transactions", render: () => <SalesOrPurchaseReport kind="sales" /> },
  { key: "purchase", label: "Purchase Report", icon: Truck, group: "Transactions", render: () => <SalesOrPurchaseReport kind="purchase" /> },
  { key: "pnl", label: "Profit & Loss", icon: Scale, group: "Transactions", render: () => <ProfitLossReport /> },
  { key: "payments", label: "Payment Report", icon: Wallet, group: "Transactions", render: () => <PaymentReport /> },
  { key: "expenses", label: "Expense Report", icon: Receipt, group: "Transactions", render: () => <ExpenseReport /> },
  { key: "stock", label: "Stock Report", icon: Boxes, group: "Inventory", render: () => <StockReport /> },
  { key: "valuation", label: "Stock Valuation", icon: Warehouse, group: "Inventory", render: () => <StockValuationReport /> },
  { key: "manufacturing", label: "Manufacturing Report", icon: Factory, group: "Inventory", render: () => <ManufacturingReport /> },
  { key: "outstanding", label: "Party Outstanding", icon: Users, group: "Parties", render: () => <OutstandingReport /> },
  { key: "customer", label: "Customer Statement", icon: FileText, group: "Parties", render: () => <StatementReport key="c" role="customer" /> },
  { key: "supplier", label: "Supplier Statement", icon: FileText, group: "Parties", render: () => <StatementReport key="s" role="supplier" /> },
]

export default function ReportsPage() {
  return (
    <Suspense>
      <Reports />
    </Suspense>
  )
}

function Reports() {
  const router = useRouter()
  const params = useSearchParams()
  const current = REPORTS.find((r) => r.key === params.get("r")) ?? REPORTS[0]
  const go = (key: string) => router.replace(`/reports?r=${key}`, { scroll: false })
  const groups = [...new Set(REPORTS.map((r) => r.group))]

  return (
    <div>
      <PageHeader title="Reports" description="Business reports with filters, search, export to Excel (CSV) and print." />
      <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
        <div className="lg:hidden print:hidden">
          <SimpleSelect value={current.key} onChange={go} options={REPORTS.map((r) => ({ value: r.key, label: r.label }))} />
        </div>
        <nav className="hidden self-start rounded-lg border bg-card p-2 shadow-xs lg:sticky lg:top-[4.5rem] lg:block print:hidden">
          {groups.map((g) => (
            <div key={g} className="mb-2 last:mb-0">
              <div className="px-2 py-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{g}</div>
              {REPORTS.filter((r) => r.group === g).map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => go(r.key)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                    current.key === r.key ? "bg-primary/10 font-medium text-primary" : "text-foreground/80 hover:bg-muted",
                  )}
                >
                  <r.icon className="size-4 shrink-0" />
                  {r.label}
                </button>
              ))}
            </div>
          ))}
          <div className="mt-2 flex items-start gap-2 border-t px-2 pt-3 text-xs text-muted-foreground">
            <BarChart3 className="mt-0.5 size-3.5 shrink-0" /> All figures update live as you record sales, purchases and payments.
          </div>
        </nav>
        <div key={current.key} className="min-w-0">{current.render()}</div>
      </div>
    </div>
  )
}
