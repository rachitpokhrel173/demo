"use client"

import { Suspense, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Download, Eye, MoreHorizontal, Plus, Printer, Wallet } from "lucide-react"
import { downloadCSV, fmtDate, npr } from "@/lib/format"
import { docStatus, sumBy, type DocStatus } from "@/lib/ledger"
import { useInvoicePaid } from "@/lib/hooks"
import { useStore } from "@/lib/store"
import { useUI } from "@/lib/ui-store"
import type { Invoice } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { DataTable, type Column } from "@/components/shared/data-table"
import { DateRangeFilter, FilterBar, SearchInput, Segmented, inRange, rangeFor, type DateRange } from "@/components/shared/filters"
import { Money, PageHeader, StatCard } from "@/components/shared/ui-bits"
import { StatusBadge } from "@/components/shared/status-badge"

type Row = Invoice & { paid: number; due: number; status: DocStatus }

export default function InvoicesPage() {
  return (
    <Suspense>
      <Invoices />
    </Suspense>
  )
}

function Invoices() {
  const router = useRouter()
  const params = useSearchParams()
  const invoices = useStore((s) => s.invoices)
  const openDialog = useUI((s) => s.openDialog)
  const paidMap = useInvoicePaid()
  const [q, setQ] = useState("")
  const [status, setStatus] = useState<"all" | DocStatus>((params.get("status") as DocStatus) ?? "all")
  const [range, setRange] = useState<DateRange>(rangeFor("all"))

  const rows: Row[] = useMemo(
    () =>
      invoices.map((i) => {
        const paid = Math.min(paidMap[i.id] ?? 0, i.total)
        return { ...i, paid, due: i.cancelled ? 0 : Math.max(0, i.total - paid), status: docStatus(i.total, paid, i.cancelled) }
      }),
    [invoices, paidMap],
  )
  const inDate = useMemo(() => rows.filter((r) => inRange(r.date, range)), [rows, range])
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return inDate.filter(
      (r) =>
        (status === "all" || r.status === status || (status === "due" && r.status === "partial")) &&
        (!s || r.number.toLowerCase().includes(s) || r.customerName.toLowerCase().includes(s)),
    )
  }, [inDate, q, status])

  const count = (st: DocStatus) => inDate.filter((r) => r.status === st).length
  const active = inDate.filter((r) => !r.cancelled)

  const columns: Column<Row>[] = [
    { key: "number", header: "Invoice No.", cell: (r) => <span className="font-medium text-primary">{r.number}</span>, sortValue: (r) => Number(r.number.replace(/\D/g, "")) },
    { key: "date", header: "Date", cell: (r) => fmtDate(r.date), sortValue: (r) => r.date + r.createdAt },
    { key: "customer", header: "Customer", cell: (r) => <span className="block max-w-64 truncate">{r.customerName}</span>, sortValue: (r) => r.customerName },
    { key: "items", header: "Items", cell: (r) => <span className="text-muted-foreground">{r.items.length}</span>, align: "center" },
    { key: "total", header: "Amount", cell: (r) => <Money value={r.total} className="font-medium" />, align: "right", sortValue: (r) => r.total },
    { key: "paid", header: "Paid", cell: (r) => <Money value={r.paid} />, align: "right", sortValue: (r) => r.paid },
    { key: "due", header: "Due", cell: (r) => <Money value={r.due} kind="due" />, align: "right", sortValue: (r) => r.due },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (r) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Actions" />}>
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => router.push(`/invoices/${r.id}`)}><Eye /> View</DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(`/invoices/${r.id}?print=1`)}><Printer /> Print</DropdownMenuItem>
              {r.due > 0 && r.partyId && (
                <DropdownMenuItem onClick={() => openDialog({ kind: "payment", direction: "in", invoiceId: r.id })}><Wallet /> Record Payment</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ]

  const exportCsv = () =>
    downloadCSV("invoices", [
      ["Invoice No", "Date", "Customer", "Amount", "Paid", "Due", "Status"],
      ...filtered.map((r) => [r.number, r.date, r.customerName, r.total, r.paid, r.due, r.status]),
    ])

  return (
    <div>
      <PageHeader
        title="Billing / Invoices"
        description="All sales invoices with payment status."
        actions={
          <>
            <Button variant="outline" className="h-9" onClick={exportCsv}><Download /> Export</Button>
            <Button className="h-9" render={<Link href="/sales" />} nativeButton={false}><Plus /> New Invoice</Button>
          </>
        }
      />
      <div className="mb-4 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Invoiced" value={npr(sumBy(active, (r) => r.total))} hint={`${active.length} invoices`} />
        <StatCard label="Received" value={npr(sumBy(active, (r) => r.paid))} tone="success" />
        <StatCard label="Outstanding" value={npr(sumBy(active, (r) => r.due))} hint={`${count("due") + count("partial")} invoices`} />
        <StatCard label="Cancelled" value={count("cancelled")} hint="Voided invoices" />
      </div>
      <FilterBar>
        <SearchInput value={q} onChange={setQ} placeholder="Search invoice no. or customer" />
        <DateRangeFilter value={range} onChange={setRange} />
        <Segmented
          className="sm:ml-auto"
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "All", count: inDate.length },
            { value: "paid", label: "Paid", count: count("paid") },
            { value: "partial", label: "Partial", count: count("partial") },
            { value: "due", label: "Due", count: count("due") + count("partial") },
            { value: "cancelled", label: "Cancelled", count: count("cancelled") },
          ]}
        />
      </FilterBar>
      <DataTable
        rows={filtered}
        columns={columns}
        getRowId={(r) => r.id}
        onRowClick={(r) => router.push(`/invoices/${r.id}`)}
        initialSort={{ key: "number", dir: "desc" }}
        emptyTitle="No invoices found"
        emptyAction={<Button render={<Link href="/sales" />} nativeButton={false}><Plus /> Create Invoice</Button>}
        mobileCard={(r) => (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium text-primary">{r.number}</div>
              <div className="truncate text-sm">{r.customerName}</div>
              <div className="text-xs text-muted-foreground">{fmtDate(r.date)}</div>
            </div>
            <div className="text-right">
              <div className="num text-sm font-semibold">{npr(r.total)}</div>
              {r.due > 0 && <div className="num text-xs text-destructive">Due {npr(r.due)}</div>}
              <StatusBadge status={r.status} className="mt-1" />
            </div>
          </div>
        )}
      />
    </div>
  )
}
