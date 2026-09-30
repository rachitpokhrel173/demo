"use client"

import { Suspense, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { ArrowDownLeft, ArrowUpRight, Download, Trash2 } from "lucide-react"
import { downloadCSV, fmtDate, methodLabel, npr, PAYMENT_METHODS } from "@/lib/format"
import { sumBy } from "@/lib/ledger"
import { usePartyMap } from "@/lib/hooks"
import { useStore } from "@/lib/store"
import { confirmAction, useUI } from "@/lib/ui-store"
import type { Payment } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/shared/data-table"
import { DateRangeFilter, FilterBar, SearchInput, Segmented, SimpleSelect, inRange, rangeFor, type DateRange } from "@/components/shared/filters"
import { Money, PageHeader, StatCard } from "@/components/shared/ui-bits"
import { StatusBadge } from "@/components/shared/status-badge"

export default function PaymentsPage() {
  return (
    <Suspense>
      <Payments />
    </Suspense>
  )
}

function Payments() {
  const params = useSearchParams()
  const payments = useStore((s) => s.payments)
  const invoices = useStore((s) => s.invoices)
  const purchases = useStore((s) => s.purchases)
  const deletePayment = useStore((s) => s.deletePayment)
  const openDialog = useUI((s) => s.openDialog)
  const partyMap = usePartyMap()
  const [tab, setTab] = useState<"in" | "out">((params.get("tab") as "out") ?? "in")
  const [q, setQ] = useState(params.get("q") ?? "")
  const [method, setMethod] = useState("all")
  const [range, setRange] = useState<DateRange>(params.get("q") ? rangeFor("all") : rangeFor("30d"))

  const docNo = useMemo(() => {
    const m: Record<string, string> = {}
    invoices.forEach((i) => (m[i.id] = i.number))
    purchases.forEach((p) => (m[p.id] = p.number))
    return m
  }, [invoices, purchases])

  const appliedTo = (p: Payment) => {
    const ids = [p.invoiceId, p.purchaseId, ...(p.allocations ?? []).map((a) => a.docId)].filter(Boolean) as string[]
    return ids.map((i) => docNo[i]).filter(Boolean)
  }

  const inDate = useMemo(() => payments.filter((p) => inRange(p.date, range)), [payments, range])
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase()
    return inDate
      .filter((p) => p.direction === tab && (method === "all" || p.method === method))
      .filter((p) => !s || p.number.toLowerCase().includes(s) || (p.reference ?? "").toLowerCase().includes(s) || (p.partyId ? partyMap[p.partyId]?.name.toLowerCase().includes(s) : "walk-in".includes(s)))
      .sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number))
  }, [inDate, tab, method, q, partyMap])

  const received = sumBy(inDate.filter((p) => p.direction === "in"), (p) => p.amount)
  const paidOut = sumBy(inDate.filter((p) => p.direction === "out"), (p) => p.amount)
  const byMethod = PAYMENT_METHODS.filter((m) => m.value !== "credit")
    .map((m) => ({ label: m.label, value: sumBy(inDate.filter((p) => p.direction === "in" && p.method === m.value), (p) => p.amount) }))
    .filter((m) => m.value > 0)

  const remove = async (p: Payment) => {
    const ok = await confirmAction({ title: `Delete payment ${p.number}?`, description: `${npr(p.amount)} will be removed and the party balance will be updated.`, confirmText: "Delete", destructive: true })
    if (!ok) return
    deletePayment(p.id)
    toast.success("Payment deleted")
  }

  return (
    <div>
      <PageHeader
        title="Payments"
        description="Money received from customers and paid to suppliers. Party balances update automatically."
        actions={
          <>
            <Button variant="outline" className="h-9" onClick={() => downloadCSV(`payments-${tab}`, [["Receipt No", "Date", "Party", "Method", "Reference", "Amount", "Applied To"], ...rows.map((p) => [p.number, p.date, p.partyId ? partyMap[p.partyId]?.name ?? "" : "Walk-in", methodLabel(p.method), p.reference ?? "", p.amount, appliedTo(p).join(" ")])])}>
              <Download /> Export
            </Button>
            <Button variant="outline" className="h-9" onClick={() => openDialog({ kind: "payment", direction: "out" })}><ArrowUpRight /> Give Payment</Button>
            <Button className="h-9" onClick={() => openDialog({ kind: "payment", direction: "in" })}><ArrowDownLeft /> Receive Payment</Button>
          </>
        }
      />
      <div className="mb-4 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Money Received" value={npr(received)} icon={ArrowDownLeft} tone="success" hint={`${inDate.filter((p) => p.direction === "in").length} receipts in period`} />
        <StatCard label="Money Paid" value={npr(paidOut)} icon={ArrowUpRight} tone="danger" hint={`${inDate.filter((p) => p.direction === "out").length} payments in period`} />
        <StatCard label="Net Cash Flow" value={npr(received - paidOut)} tone={received >= paidOut ? "success" : "danger"} />
        <StatCard label="Receipts by Method" value={byMethod[0] ? byMethod.sort((a, b) => b.value - a.value)[0].label : "—"} hint={byMethod.slice(0, 3).map((m) => `${m.label} ${npr(m.value)}`).join(" · ")} />
      </div>
      <FilterBar>
        <Segmented value={tab} onChange={setTab} options={[{ value: "in", label: "Money Received" }, { value: "out", label: "Money Paid" }]} />
        <SearchInput value={q} onChange={setQ} placeholder="Search party, receipt no., reference" />
        <SimpleSelect value={method} onChange={setMethod} className="sm:w-40" options={[{ value: "all", label: "All methods" }, ...PAYMENT_METHODS.filter((m) => m.value !== "credit").map((m) => ({ value: m.value, label: m.label }))]} />
        <DateRangeFilter value={range} onChange={setRange} />
      </FilterBar>
      <DataTable
        rows={rows}
        getRowId={(r) => r.id}
        pageSize={15}
        emptyTitle={tab === "in" ? "No money received in this period" : "No payments made in this period"}
        emptyAction={<Button onClick={() => openDialog({ kind: "payment", direction: tab })}>{tab === "in" ? "Receive Payment" : "Give Payment"}</Button>}
        columns={[
          { key: "no", header: tab === "in" ? "Receipt No." : "Payment No.", cell: (r) => <span className="font-medium">{r.number}</span> },
          { key: "date", header: "Date", cell: (r) => fmtDate(r.date) },
          { key: "party", header: "Party", cell: (r) => <span className="block max-w-56 truncate">{r.partyId ? partyMap[r.partyId]?.name : "Cash Sale (Walk-in)"}</span> },
          { key: "method", header: "Method", cell: (r) => <StatusBadge label={methodLabel(r.method)} tone={r.method === "cash" ? "green" : r.method === "bank" ? "blue" : "violet"} /> },
          { key: "ref", header: "Reference", cell: (r) => <span className="text-muted-foreground">{r.reference ?? "—"}</span> },
          { key: "applied", header: "Against", cell: (r) => <span className="block max-w-48 truncate text-xs text-muted-foreground">{appliedTo(r).join(", ") || "On account"}</span> },
          { key: "amount", header: "Amount", align: "right", cell: (r) => <Money value={r.amount} className={tab === "in" ? "font-semibold text-success" : "font-semibold text-destructive"} /> },
          {
            key: "act",
            header: "",
            align: "right",
            cell: (r) => (
              <Button variant="ghost" size="icon-sm" onClick={() => remove(r)} aria-label="Delete payment">
                <Trash2 />
              </Button>
            ),
          },
        ]}
        mobileCard={(r) => (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{r.partyId ? partyMap[r.partyId]?.name : "Walk-in"}</div>
              <div className="text-xs text-muted-foreground">{r.number} · {fmtDate(r.date)} · {methodLabel(r.method)}</div>
            </div>
            <Money value={r.amount} className="font-semibold" />
          </div>
        )}
      />
    </div>
  )
}
