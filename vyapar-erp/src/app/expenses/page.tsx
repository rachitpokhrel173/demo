"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Download, Pencil, Plus, Trash2 } from "lucide-react"
import { downloadCSV, fmtDate, methodLabel, npr } from "@/lib/format"
import { sumBy } from "@/lib/ledger"
import { useStore } from "@/lib/store"
import { confirmAction, useUI } from "@/lib/ui-store"
import type { Expense } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/shared/data-table"
import { DateRangeFilter, FilterBar, SearchInput, SimpleSelect, inRange, rangeFor, type DateRange } from "@/components/shared/filters"
import { Money, PageHeader, Panel, StatCard } from "@/components/shared/ui-bits"
import { StatusBadge } from "@/components/shared/status-badge"
import { HBarChart } from "@/components/shared/charts"
import { EXPENSE_CATEGORIES } from "@/components/dialogs/global-dialogs"

export default function ExpensesPage() {
  const expenses = useStore((s) => s.expenses)
  const deleteExpense = useStore((s) => s.deleteExpense)
  const openDialog = useUI((s) => s.openDialog)
  const [q, setQ] = useState("")
  const [cat, setCat] = useState("all")
  const [range, setRange] = useState<DateRange>(rangeFor("30d"))

  const inDate = useMemo(() => expenses.filter((e) => inRange(e.date, range)), [expenses, range])
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase()
    return inDate
      .filter((e) => (cat === "all" || e.category === cat) && (!s || e.description.toLowerCase().includes(s) || (e.paidTo ?? "").toLowerCase().includes(s)))
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [inDate, q, cat])

  const total = sumBy(inDate, (e) => e.amount)
  const byCat = EXPENSE_CATEGORIES.map((c) => ({ label: c, value: sumBy(inDate.filter((e) => e.category === c), (e) => e.amount) }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value)

  const remove = async (e: Expense) => {
    if (!(await confirmAction({ title: "Delete this expense?", description: `${e.category} · ${npr(e.amount)}`, confirmText: "Delete", destructive: true }))) return
    deleteExpense(e.id)
    toast.success("Expense deleted")
  }

  return (
    <div>
      <PageHeader
        title="Expenses"
        description="Rent, salary, electricity and other business running costs."
        actions={
          <>
            <Button variant="outline" className="h-9" onClick={() => downloadCSV("expenses", [["Date", "Category", "Description", "Paid To", "Method", "Amount"], ...rows.map((e) => [e.date, e.category, e.description, e.paidTo ?? "", methodLabel(e.method), e.amount])])}>
              <Download /> Export
            </Button>
            <Button className="h-9" onClick={() => openDialog({ kind: "expense" })}><Plus /> Add Expense</Button>
          </>
        }
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          <div className="mb-4 grid grid-cols-1 gap-3 min-[480px]:grid-cols-3">
            <StatCard label="Total Expenses" value={npr(total)} tone="danger" hint={`${inDate.length} entries in period`} />
            <StatCard label="Largest Category" value={byCat[0]?.label ?? "—"} hint={byCat[0] ? npr(byCat[0].value) : undefined} />
            <StatCard label="Average per Entry" value={npr(inDate.length ? total / inDate.length : 0)} />
          </div>
          <FilterBar>
            <SearchInput value={q} onChange={setQ} placeholder="Search description or payee" />
            <SimpleSelect value={cat} onChange={setCat} className="sm:w-44" options={[{ value: "all", label: "All categories" }, ...EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))]} />
            <DateRangeFilter value={range} onChange={setRange} />
          </FilterBar>
          <DataTable
            rows={rows}
            getRowId={(r) => r.id}
            emptyTitle="No expenses in this period"
            emptyAction={<Button onClick={() => openDialog({ kind: "expense" })}><Plus /> Add Expense</Button>}
            columns={[
              { key: "date", header: "Date", cell: (r) => fmtDate(r.date), sortValue: (r) => r.date },
              { key: "cat", header: "Category", cell: (r) => <StatusBadge label={r.category} tone="gray" /> },
              { key: "desc", header: "Description", cell: (r) => <span className="block max-w-72 truncate">{r.description}</span> },
              { key: "to", header: "Paid To", cell: (r) => <span className="text-muted-foreground">{r.paidTo ?? "—"}</span> },
              { key: "method", header: "Method", cell: (r) => methodLabel(r.method) },
              { key: "amount", header: "Amount", align: "right", sortValue: (r) => r.amount, cell: (r) => <Money value={r.amount} className="font-medium" /> },
              {
                key: "act",
                header: "",
                align: "right",
                cell: (r) => (
                  <div className="flex justify-end">
                    <Button variant="ghost" size="icon-sm" onClick={() => openDialog({ kind: "expense", expense: r })} aria-label="Edit"><Pencil /></Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => remove(r)} aria-label="Delete"><Trash2 /></Button>
                  </div>
                ),
              },
            ]}
            mobileCard={(r) => (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{r.description}</div>
                  <div className="text-xs text-muted-foreground">{r.category} · {fmtDate(r.date)}</div>
                </div>
                <Money value={r.amount} className="font-semibold" />
              </div>
            )}
          />
        </div>
        <Panel title="By Category" description="Expense breakdown for the selected period" className="self-start">
          {byCat.length ? <HBarChart data={byCat} name="Expense" color="#eb6834" /> : <div className="py-8 text-center text-sm text-muted-foreground">No expenses.</div>}
        </Panel>
      </div>
    </div>
  )
}
