"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Download, Plus } from "lucide-react"
import { downloadCSV, fmtDate, npr } from "@/lib/format"
import { docStatus, sumBy, type DocStatus } from "@/lib/ledger"
import { usePartyMap, usePurchasePaid } from "@/lib/hooks"
import { useStore } from "@/lib/store"
import type { Purchase } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { DataTable, type Column } from "@/components/shared/data-table"
import { DateRangeFilter, FilterBar, SearchInput, Segmented, inRange, rangeFor, type DateRange } from "@/components/shared/filters"
import { Money, PageHeader, StatCard } from "@/components/shared/ui-bits"
import { StatusBadge } from "@/components/shared/status-badge"

type Row = Purchase & { supplier: string; paid: number; due: number; status: DocStatus }

export default function PurchasesPage() {
  const router = useRouter()
  const purchases = useStore((s) => s.purchases)
  const partyMap = usePartyMap()
  const paidMap = usePurchasePaid()
  const [q, setQ] = useState("")
  const [status, setStatus] = useState<"all" | DocStatus>("all")
  const [range, setRange] = useState<DateRange>(rangeFor("all"))

  const rows: Row[] = useMemo(
    () =>
      purchases.map((p) => {
        const paid = Math.min(paidMap[p.id] ?? 0, p.total)
        return { ...p, supplier: partyMap[p.partyId]?.name ?? "—", paid, due: p.cancelled ? 0 : Math.max(0, p.total - paid), status: docStatus(p.total, paid, p.cancelled) }
      }),
    [purchases, paidMap, partyMap],
  )
  const inDate = useMemo(() => rows.filter((r) => inRange(r.date, range)), [rows, range])
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return inDate.filter((r) => (status === "all" || r.status === status) && (!s || r.number.toLowerCase().includes(s) || r.supplier.toLowerCase().includes(s) || r.supplierBillNo.includes(s)))
  }, [inDate, q, status])
  const active = inDate.filter((r) => !r.cancelled)
  const count = (st: DocStatus) => inDate.filter((r) => r.status === st).length

  const columns: Column<Row>[] = [
    { key: "number", header: "Purchase No.", cell: (r) => <span className="font-medium text-primary">{r.number}</span>, sortValue: (r) => Number(r.number.replace(/\D/g, "")) },
    { key: "date", header: "Date", cell: (r) => fmtDate(r.date), sortValue: (r) => r.date },
    { key: "supplier", header: "Supplier", cell: (r) => r.supplier, sortValue: (r) => r.supplier },
    { key: "bill", header: "Supplier Bill", cell: (r) => <span className="text-muted-foreground">{r.supplierBillNo || "—"}</span> },
    { key: "items", header: "Items", cell: (r) => <span className="block max-w-56 truncate text-muted-foreground">{r.items.map((i) => i.name.split(" —")[0]).join(", ")}</span> },
    { key: "total", header: "Amount", cell: (r) => <Money value={r.total} className="font-medium" />, align: "right", sortValue: (r) => r.total },
    { key: "paid", header: "Paid", cell: (r) => <Money value={r.paid} />, align: "right" },
    { key: "due", header: "Due", cell: (r) => <Money value={r.due} kind="due" />, align: "right", sortValue: (r) => r.due },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
  ]

  return (
    <div>
      <PageHeader
        title="Purchase"
        description="Supplier bills. Every purchase adds stock to inventory."
        actions={
          <>
            <Button variant="outline" className="h-9" onClick={() => downloadCSV("purchases", [["Purchase No", "Date", "Supplier", "Supplier Bill", "Amount", "Paid", "Due", "Status"], ...filtered.map((r) => [r.number, r.date, r.supplier, r.supplierBillNo, r.total, r.paid, r.due, r.status])])}>
              <Download /> Export
            </Button>
            <Button className="h-9" render={<Link href="/purchases/new" />} nativeButton={false}><Plus /> New Purchase</Button>
          </>
        }
      />
      <div className="mb-4 grid grid-cols-1 gap-3 min-[480px]:grid-cols-3">
        <StatCard label="Total Purchase" value={npr(sumBy(active, (r) => r.total))} hint={`${active.length} bills`} />
        <StatCard label="Paid to Suppliers" value={npr(sumBy(active, (r) => r.paid))} tone="success" />
        <StatCard label="Outstanding to Suppliers" value={npr(sumBy(active, (r) => r.due))} tone="danger" />
      </div>
      <FilterBar>
        <SearchInput value={q} onChange={setQ} placeholder="Search purchase no., supplier, bill no." />
        <DateRangeFilter value={range} onChange={setRange} />
        <Segmented
          className="sm:ml-auto"
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "All", count: inDate.length },
            { value: "paid", label: "Paid", count: count("paid") },
            { value: "partial", label: "Partial", count: count("partial") },
            { value: "due", label: "Due", count: count("due") },
            { value: "cancelled", label: "Cancelled", count: count("cancelled") },
          ]}
        />
      </FilterBar>
      <DataTable
        rows={filtered}
        columns={columns}
        getRowId={(r) => r.id}
        onRowClick={(r) => router.push(`/purchases/${r.id}`)}
        initialSort={{ key: "number", dir: "desc" }}
        emptyTitle="No purchases found"
        emptyAction={<Button render={<Link href="/purchases/new" />} nativeButton={false}><Plus /> New Purchase</Button>}
        mobileCard={(r) => (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium text-primary">{r.number}</div>
              <div className="truncate text-sm">{r.supplier}</div>
              <div className="text-xs text-muted-foreground">{fmtDate(r.date)}</div>
            </div>
            <div className="text-right">
              <div className="num text-sm font-semibold">{npr(r.total)}</div>
              <StatusBadge status={r.status} className="mt-1" />
            </div>
          </div>
        )}
      />
    </div>
  )
}
