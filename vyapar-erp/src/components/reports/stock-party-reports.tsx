"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { differenceInDays, parseISO } from "date-fns"
import { fmtDate, npr, qty, round2 } from "@/lib/format"
import { partyLedger, stockStatus, sumBy } from "@/lib/ledger"
import { useDocPaid, usePartySummaries, useProductMap, useStockMap } from "@/lib/hooks"
import { useStore } from "@/lib/store"
import { SimpleSelect, inRange, rangeFor, type DateRange } from "@/components/shared/filters"
import { StatusBadge } from "@/components/shared/status-badge"
import { HBarChart, SERIES } from "@/components/shared/charts"
import { Panel } from "@/components/shared/ui-bits"
import { PartyPicker } from "@/components/shared/pickers"
import { StatementDocument } from "@/components/shared/statement-document"
import { ReportFrame, ReportTable, SummaryGrid, exportReport, type RCol } from "./report-kit"

const has = (s: string, q: string) => s.toLowerCase().includes(q.trim().toLowerCase())

// ------------------------------------------------------------------ Stock movement summary
export function StockReport() {
  const products = useStore((s) => s.products)
  const moves = useStore((s) => s.stockMovements)
  const categories = useStore((s) => s.categories)
  const [range, setRange] = useState<DateRange>(rangeFor("30d"))
  const [q, setQ] = useState("")
  const [cat, setCat] = useState("all")

  const rows = useMemo(() => {
    return products
      .filter((p) => (cat === "all" || p.category === cat) && (!q || has(p.name, q) || has(p.sku, q)))
      .map((p) => {
        let opening = 0, inQ = 0, outQ = 0
        for (const m of moves) {
          if (m.productId !== p.id) continue
          if (m.date < range.from) opening += m.qty
          else if (m.date <= range.to) {
            if (m.qty > 0) inQ += m.qty
            else outQ += -m.qty
          }
        }
        const closing = round2(opening + inQ - outQ)
        return { p, opening: round2(opening), inQ: round2(inQ), outQ: round2(outQ), closing, st: stockStatus(p, closing) }
      })
  }, [products, moves, range, q, cat])
  type Row = (typeof rows)[number]
  const cols: RCol<Row>[] = [
    { header: "Product", cell: (r) => <Link href={`/products/${r.p.id}`} className="font-medium hover:underline">{r.p.name}</Link>, value: (r) => r.p.name },
    { header: "Unit", cell: (r) => r.p.unit, value: (r) => r.p.unit },
    { header: "Opening", align: "right", cell: (r) => qty(r.opening), value: (r) => r.opening },
    { header: "Stock In", align: "right", cell: (r) => <span className="text-success">{r.inQ ? `+${qty(r.inQ)}` : "—"}</span>, value: (r) => r.inQ },
    { header: "Stock Out", align: "right", cell: (r) => <span className="text-destructive">{r.outQ ? `−${qty(r.outQ)}` : "—"}</span>, value: (r) => r.outQ },
    { header: "Closing", align: "right", cell: (r) => <span className="font-semibold">{qty(r.closing)}</span>, value: (r) => r.closing },
    { header: "Status", cell: (r) => <StatusBadge status={r.st} />, value: (r) => r.st },
  ]
  return (
    <ReportFrame
      title="Stock Report"
      description="Opening, stock in, stock out and closing quantity for each product."
      range={range}
      onRange={setRange}
      search={q}
      onSearch={setQ}
      searchPlaceholder="Search product or SKU"
      onExport={() => exportReport("stock-report", cols, rows)}
      filters={<SimpleSelect value={cat} onChange={setCat} className="sm:w-48" options={[{ value: "all", label: "All categories" }, ...categories.map((c) => ({ value: c, label: c }))]} />}
    >
      <SummaryGrid
        items={[
          { label: "Products", value: rows.length },
          { label: "Low Stock", value: rows.filter((r) => r.st === "low").length },
          { label: "Out of Stock", value: rows.filter((r) => r.st === "out").length, tone: "danger" },
          { label: "Items moved", value: rows.filter((r) => r.inQ || r.outQ).length, tone: "primary" },
        ]}
      />
      <ReportTable cols={cols} rows={rows} getKey={(r) => r.p.id} />
    </ReportFrame>
  )
}

// ------------------------------------------------------------------ Stock valuation
export function StockValuationReport() {
  const products = useStore((s) => s.products)
  const categories = useStore((s) => s.categories)
  const stock = useStockMap()
  const [q, setQ] = useState("")
  const [cat, setCat] = useState("all")
  const rows = useMemo(
    () =>
      products
        .filter((p) => (cat === "all" || p.category === cat) && (!q || has(p.name, q) || has(p.sku, q)))
        .map((p) => {
          const s = Math.max(0, stock[p.id] ?? 0)
          return { p, s, cost: round2(s * p.purchasePrice), sale: round2(s * p.sellingPrice) }
        })
        .sort((a, b) => b.cost - a.cost),
    [products, stock, q, cat],
  )
  type Row = (typeof rows)[number]
  const cost = sumBy(rows, (r) => r.cost)
  const sale = sumBy(rows.filter((r) => r.p.sellingPrice > 0), (r) => r.sale)
  const byCat = useMemo(() => {
    const m: Record<string, number> = {}
    rows.forEach((r) => (m[r.p.category] = (m[r.p.category] ?? 0) + r.cost))
    return Object.entries(m).map(([label, value]) => ({ label, value: Math.round(value) })).sort((a, b) => b.value - a.value)
  }, [rows])
  const cols: RCol<Row>[] = [
    { header: "Product", cell: (r) => <Link href={`/products/${r.p.id}`} className="font-medium hover:underline">{r.p.name}</Link>, value: (r) => r.p.name },
    { header: "Category", cell: (r) => <span className="text-muted-foreground">{r.p.category}</span>, value: (r) => r.p.category },
    { header: "Quantity", align: "right", cell: (r) => `${qty(r.s)} ${r.p.unit}`, value: (r) => r.s },
    { header: "Cost Price", align: "right", cell: (r) => npr(r.p.purchasePrice), value: (r) => r.p.purchasePrice },
    { header: "Value at Cost", align: "right", cell: (r) => <span className="font-medium">{npr(r.cost)}</span>, value: (r) => r.cost, total: npr(cost) },
    { header: "Value at Selling Price", align: "right", cell: (r) => (r.p.sellingPrice ? npr(r.sale) : "—"), value: (r) => r.sale, total: npr(sale) },
  ]
  return (
    <ReportFrame
      title="Stock Valuation"
      description="Current stock valued at latest cost price and at selling price."
      search={q}
      onSearch={setQ}
      searchPlaceholder="Search product or SKU"
      onExport={() => exportReport("stock-valuation", cols, rows)}
      filters={<SimpleSelect value={cat} onChange={setCat} className="sm:w-48" options={[{ value: "all", label: "All categories" }, ...categories.map((c) => ({ value: c, label: c }))]} />}
    >
      <SummaryGrid items={[{ label: "Stock Value (Cost)", value: npr(cost), tone: "primary" }, { label: "Value at Selling Price", value: npr(sale) }, { label: "Potential Profit (saleable)", value: npr(sale - sumBy(rows.filter((r) => r.p.sellingPrice > 0), (r) => r.cost)), tone: "success" }, { label: "Products", value: rows.length }]} />
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <ReportTable cols={cols} rows={rows} getKey={(r) => r.p.id} />
        <Panel title="Value by category" className="self-start print:hidden">
          <HBarChart data={byCat} name="Stock value" color={SERIES.sales} />
        </Panel>
      </div>
    </ReportFrame>
  )
}

// ------------------------------------------------------------------ Manufacturing
export function ManufacturingReport() {
  const router = useRouter()
  const productions = useStore((s) => s.productions)
  const productMap = useProductMap()
  const [range, setRange] = useState<DateRange>(rangeFor("90d"))
  const [q, setQ] = useState("")
  const [status, setStatus] = useState("all")
  const rows = useMemo(
    () =>
      productions
        .filter((p) => inRange(p.date, range) && (status === "all" || p.status === status) && (!q || has(p.number, q) || has(productMap[p.productId]?.name ?? "", q)))
        .slice()
        .reverse(),
    [productions, range, status, q, productMap],
  )
  type Row = (typeof rows)[number]
  const completed = rows.filter((r) => r.status === "completed")
  const consumption = useMemo(() => {
    const m: Record<string, number> = {}
    completed.forEach((p) => p.materials.forEach((mm) => (m[mm.productId] = (m[mm.productId] ?? 0) + mm.actual * mm.rate)))
    return Object.entries(m).map(([id, value]) => ({ label: productMap[id]?.name.replace("Raw Material A — ", "") ?? id, value: Math.round(value) })).sort((a, b) => b.value - a.value)
  }, [completed, productMap])
  const cols: RCol<Row>[] = [
    { header: "Production ID", cell: (r) => <span className="font-medium text-primary">{r.number}</span>, value: (r) => r.number },
    { header: "Date", cell: (r) => fmtDate(r.date), value: (r) => r.date },
    { header: "Product", cell: (r) => productMap[r.productId]?.name, value: (r) => productMap[r.productId]?.name ?? "" },
    { header: "Quantity", align: "right", cell: (r) => `${qty(r.qty)} ${productMap[r.productId]?.unit}`, value: (r) => r.qty, total: qty(sumBy(completed, (r) => r.qty)) },
    { header: "Material Cost", align: "right", cell: (r) => npr(r.materialCost), value: (r) => r.materialCost, total: npr(sumBy(completed, (r) => r.materialCost)) },
    { header: "Overhead", align: "right", cell: (r) => npr(r.overheadCost), value: (r) => r.overheadCost, total: npr(sumBy(completed, (r) => r.overheadCost)) },
    { header: "Total Cost", align: "right", cell: (r) => <span className="font-medium">{npr(r.totalCost)}</span>, value: (r) => r.totalCost, total: npr(sumBy(completed, (r) => r.totalCost)) },
    { header: "Cost / Unit", align: "right", cell: (r) => npr(r.totalCost / r.qty), value: (r) => round2(r.totalCost / r.qty) },
    { header: "Status", cell: (r) => <StatusBadge status={r.status} />, value: (r) => r.status },
  ]
  return (
    <ReportFrame
      title="Manufacturing Report"
      description="Production output, cost and raw material consumption. Totals include completed batches only."
      range={range}
      onRange={setRange}
      search={q}
      onSearch={setQ}
      searchPlaceholder="Search production or product"
      onExport={() => exportReport("manufacturing-report", cols, rows)}
      filters={<SimpleSelect value={status} onChange={setStatus} className="sm:w-40" options={[{ value: "all", label: "All status" }, { value: "completed", label: "Completed" }, { value: "in_progress", label: "In Progress" }, { value: "draft", label: "Draft" }, { value: "cancelled", label: "Cancelled" }]} />}
    >
      <SummaryGrid
        items={[
          { label: "Completed batches", value: completed.length, tone: "primary" },
          { label: "Units produced", value: qty(sumBy(completed, (r) => r.qty)) },
          { label: "Total production cost", value: npr(sumBy(completed, (r) => r.totalCost)) },
          { label: "Raw material consumed", value: npr(sumBy(completed, (r) => r.materialCost)), tone: "danger" },
        ]}
      />
      {consumption.length > 0 && (
        <Panel title="Raw material consumption (value)" className="print:hidden">
          <HBarChart data={consumption} name="Consumed" color={SERIES.purchase} />
        </Panel>
      )}
      <ReportTable cols={cols} rows={rows} getKey={(r) => r.id} onRowClick={(r) => router.push(`/manufacturing/${r.id}`)} />
    </ReportFrame>
  )
}

// ------------------------------------------------------------------ Party outstanding
export function OutstandingReport() {
  const router = useRouter()
  const parties = useStore((s) => s.parties)
  const invoices = useStore((s) => s.invoices)
  const summaries = usePartySummaries()
  const paid = useDocPaid()
  const [q, setQ] = useState("")
  const [side, setSide] = useState<"receivable" | "payable">("receivable")

  const rows = useMemo(() => {
    const now = new Date()
    return parties
      .map((p) => {
        const s = summaries[p.id]
        const unpaid = invoices.filter((i) => i.partyId === p.id && !i.cancelled && i.total - (paid[i.id] ?? 0) > 0.5)
        const oldest = unpaid[0]?.date
        const aging = { a30: 0, a60: 0, a90: 0, a90p: 0 }
        unpaid.forEach((i) => {
          const d = differenceInDays(now, parseISO(i.date))
          const due = i.total - (paid[i.id] ?? 0)
          if (d <= 30) aging.a30 += due
          else if (d <= 60) aging.a60 += due
          else if (d <= 90) aging.a90 += due
          else aging.a90p += due
        })
        return { p, bal: s.balance, last: s.lastTxn, oldest, aging }
      })
      .filter((r) => (side === "receivable" ? r.bal > 0.5 : r.bal < -0.5) && (!q || has(r.p.name, q) || has(r.p.phone, q)))
      .sort((a, b) => Math.abs(b.bal) - Math.abs(a.bal))
  }, [parties, summaries, invoices, paid, side, q])
  type Row = (typeof rows)[number]
  const total = sumBy(rows, (r) => Math.abs(r.bal))
  const cols: RCol<Row>[] = [
    { header: "Party", cell: (r) => <span className="font-medium">{r.p.name}</span>, value: (r) => r.p.name },
    { header: "Phone", cell: (r) => r.p.phone, value: (r) => r.p.phone },
    { header: "Last Transaction", cell: (r) => (r.last ? fmtDate(r.last) : "—"), value: (r) => r.last ?? "" },
    ...(side === "receivable"
      ? ([
          { header: "0–30 days", align: "right", cell: (r) => npr(r.aging.a30), value: (r) => round2(r.aging.a30) },
          { header: "31–60", align: "right", cell: (r) => npr(r.aging.a60), value: (r) => round2(r.aging.a60) },
          { header: "61–90", align: "right", cell: (r) => npr(r.aging.a90), value: (r) => round2(r.aging.a90) },
          { header: "90+", align: "right", cell: (r) => <span className={r.aging.a90p > 0 ? "text-destructive" : ""}>{npr(r.aging.a90p)}</span>, value: (r) => round2(r.aging.a90p) },
          { header: "Credit Limit", align: "right", cell: (r) => (r.p.creditLimit ? npr(r.p.creditLimit) : "—"), value: (r) => r.p.creditLimit },
        ] as RCol<Row>[])
      : []),
    { header: side === "receivable" ? "Receivable" : "Payable", align: "right", cell: (r) => <span className={side === "receivable" ? "font-semibold text-success" : "font-semibold text-destructive"}>{npr(Math.abs(r.bal))}</span>, value: (r) => Math.abs(r.bal), total: npr(total) },
  ]
  return (
    <ReportFrame
      title="Party Outstanding"
      description="Who owes you and whom you owe — with invoice aging for receivables. Aging buckets cover unpaid invoices; the balance also includes opening balances."
      search={q}
      onSearch={setQ}
      searchPlaceholder="Search party or phone"
      onExport={() => exportReport(`outstanding-${side}`, cols, rows)}
      filters={<SimpleSelect value={side} onChange={(v) => setSide(v as "payable")} className="sm:w-44" options={[{ value: "receivable", label: "Receivables" }, { value: "payable", label: "Payables" }]} />}
    >
      <SummaryGrid
        items={[
          { label: side === "receivable" ? "Total Receivable" : "Total Payable", value: npr(total), tone: side === "receivable" ? "success" : "danger" },
          { label: "Parties", value: rows.length },
          { label: side === "receivable" ? "Over 90 days" : "Largest", value: side === "receivable" ? npr(sumBy(rows, (r) => r.aging.a90p)) : npr(Math.abs(rows[0]?.bal ?? 0)) },
          { label: "Over credit limit", value: rows.filter((r) => r.p.creditLimit > 0 && r.bal > r.p.creditLimit).length },
        ]}
      />
      <ReportTable cols={cols} rows={rows} getKey={(r) => r.p.id} onRowClick={(r) => router.push(`/parties/${r.p.id}`)} />
    </ReportFrame>
  )
}

// ------------------------------------------------------------------ Customer / supplier statement
export function StatementReport({ role }: { role: "customer" | "supplier" }) {
  const parties = useStore((s) => s.parties)
  const business = useStore((s) => s.business)
  const invoices = useStore((s) => s.invoices)
  const purchases = useStore((s) => s.purchases)
  const payments = useStore((s) => s.payments)
  const first = parties.find((p) => (role === "customer" ? p.type !== "supplier" : p.type !== "customer"))
  const [partyId, setPartyId] = useState<string | null>(first?.id ?? null)
  const [range, setRange] = useState<DateRange>(rangeFor("90d"))
  const party = parties.find((p) => p.id === partyId)
  const ledger = useMemo(() => (party ? partyLedger(party, { invoices, purchases, payments }, range.from, range.to) : null), [party, invoices, purchases, payments, range])

  return (
    <ReportFrame
      title={role === "customer" ? "Customer Statement" : "Supplier Statement"}
      description="Ledger statement for a single party — ready to print or send."
      range={range}
      onRange={setRange}
      onExport={
        ledger && party
          ? () =>
              exportReport(
                `statement-${party.name}`,
                [
                  { header: "Date", cell: (r: (typeof ledger.rows)[number]) => r.date, value: (r) => r.date },
                  { header: "Particulars", cell: (r) => r.type, value: (r) => r.type },
                  { header: "Ref", cell: (r) => r.ref, value: (r) => r.ref },
                  { header: "Debit", cell: (r) => r.debit, value: (r) => r.debit },
                  { header: "Credit", cell: (r) => r.credit, value: (r) => r.credit },
                  { header: "Balance", cell: (r) => r.balance, value: (r) => r.balance },
                ],
                ledger.rows,
              )
          : undefined
      }
      filters={<div className="w-full sm:w-80"><PartyPicker value={partyId} onChange={setPartyId} role={role} /></div>}
    >
      {party && ledger ? (
        <div className="overflow-x-auto rounded-lg border shadow-xs">
          <div className="min-w-[720px]">
            <StatementDocument business={business} party={party} rows={ledger.rows} opening={ledger.opening} closing={ledger.closing} from={range.from < "2001" ? party.createdAt.slice(0, 10) : range.from} to={range.to > "2900" ? new Date().toISOString().slice(0, 10) : range.to} />
          </div>
        </div>
      ) : (
        <div className="rounded-lg border bg-card py-12 text-center text-sm text-muted-foreground">Select a {role} to view the statement.</div>
      )}
    </ReportFrame>
  )
}
