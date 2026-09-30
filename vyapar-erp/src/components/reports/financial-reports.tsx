"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { bucketize, type Granularity } from "@/lib/analytics"
import { fmtDate, methodLabel, npr, PAYMENT_METHODS, qty, round2 } from "@/lib/format"
import { docStatus, sumBy } from "@/lib/ledger"
import { useDocPaid, usePartyMap } from "@/lib/hooks"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Segmented, SimpleSelect, inRange, rangeFor, type DateRange } from "@/components/shared/filters"
import { StatusBadge } from "@/components/shared/status-badge"
import { HBarChart, SERIES, TrendChart } from "@/components/shared/charts"
import { Panel } from "@/components/shared/ui-bits"
import { EXPENSE_CATEGORIES } from "@/components/dialogs/global-dialogs"
import { ReportFrame, ReportTable, SummaryGrid, exportReport, type RCol } from "./report-kit"

const has = (s: string, q: string) => s.toLowerCase().includes(q.trim().toLowerCase())

function granularityFor(r: DateRange): Granularity {
  const days = (new Date(r.to).getTime() - new Date(r.from).getTime()) / 864e5
  return days <= 31 ? "daily" : days <= 120 ? "weekly" : "monthly"
}
function periodCount(r: DateRange, g: Granularity) {
  const days = Math.min(400, Math.max(1, (Math.min(Date.now(), new Date(r.to).getTime()) - new Date(r.from).getTime()) / 864e5 + 1))
  return Math.max(1, Math.ceil(g === "daily" ? days : g === "weekly" ? days / 7 : days / 30))
}

// ------------------------------------------------------------------ Sales / Purchase
export function SalesOrPurchaseReport({ kind }: { kind: "sales" | "purchase" }) {
  const router = useRouter()
  const invoices = useStore((s) => s.invoices)
  const purchases = useStore((s) => s.purchases)
  const partyMap = usePartyMap()
  const paid = useDocPaid()
  const [range, setRange] = useState<DateRange>(rangeFor("30d"))
  const [q, setQ] = useState("")
  const [view, setView] = useState<"doc" | "period" | "product" | "party">("doc")
  const [g, setG] = useState<Granularity | "auto">("auto")

  const docs = useMemo(
    () =>
      (kind === "sales"
        ? invoices.map((i) => ({ id: i.id, number: i.number, date: i.date, party: i.customerName, items: i.items, taxable: i.taxable, tax: i.tax, total: i.total, discount: i.discount, cancelled: i.cancelled, href: `/invoices/${i.id}` }))
        : purchases.map((p) => ({ id: p.id, number: p.number, date: p.date, party: partyMap[p.partyId]?.name ?? "", items: p.items, taxable: p.taxable, tax: p.tax, total: p.total, discount: p.discount, cancelled: p.cancelled, href: `/purchases/${p.id}` }))
      ).filter((d) => !d.cancelled && inRange(d.date, range) && (!q || has(d.number, q) || has(d.party, q) || d.items.some((i) => has(i.name, q)))),
    [kind, invoices, purchases, partyMap, range, q],
  )
  type Doc = (typeof docs)[number]
  const gran = g === "auto" ? granularityFor(range) : g
  const chart = useMemo(() => bucketize(docs.map((d) => ({ date: d.date, amount: d.total })), gran, periodCount(range, gran)).map((b) => ({ label: b.label, v: b.value })), [docs, gran, range])

  const totals = { taxable: sumBy(docs, (d) => d.taxable), tax: sumBy(docs, (d) => d.tax), total: sumBy(docs, (d) => d.total), discount: sumBy(docs, (d) => d.discount), paid: sumBy(docs, (d) => Math.min(paid[d.id] ?? 0, d.total)) }
  const label = kind === "sales" ? "Sales" : "Purchase"

  const docCols: RCol<Doc>[] = [
    { header: "Date", cell: (d) => fmtDate(d.date), value: (d) => d.date },
    { header: kind === "sales" ? "Invoice" : "Purchase", cell: (d) => <span className="font-medium text-primary">{d.number}</span>, value: (d) => d.number },
    { header: kind === "sales" ? "Customer" : "Supplier", cell: (d) => <span className="block max-w-60 truncate">{d.party}</span>, value: (d) => d.party },
    { header: "Discount", align: "right", cell: (d) => npr(d.discount), value: (d) => d.discount, total: npr(totals.discount) },
    { header: "Taxable", align: "right", cell: (d) => npr(d.taxable), value: (d) => d.taxable, total: npr(totals.taxable) },
    { header: "VAT", align: "right", cell: (d) => npr(d.tax), value: (d) => d.tax, total: npr(totals.tax) },
    { header: "Total", align: "right", cell: (d) => <span className="font-medium">{npr(d.total)}</span>, value: (d) => d.total, total: npr(totals.total) },
    { header: "Status", cell: (d) => <StatusBadge status={docStatus(d.total, paid[d.id] ?? 0, false)} />, value: (d) => docStatus(d.total, paid[d.id] ?? 0, false) },
  ]

  const periodRows = useMemo(() => {
    const b = bucketize(docs.map((d) => ({ date: d.date, amount: d.total })), gran, periodCount(range, gran))
    const tax = bucketize(docs.map((d) => ({ date: d.date, amount: d.tax })), gran, periodCount(range, gran))
    const cnt = bucketize(docs.map((d) => ({ date: d.date, amount: 1 })), gran, periodCount(range, gran))
    return b.map((x, i) => ({ label: x.label, total: x.value, tax: tax[i].value, count: cnt[i].value })).filter((r) => r.count > 0).reverse()
  }, [docs, gran, range])
  type PRow = (typeof periodRows)[number]
  const periodCols: RCol<PRow>[] = [
    { header: gran === "daily" ? "Day" : gran === "weekly" ? "Week starting" : "Month", cell: (r) => r.label, value: (r) => r.label },
    { header: kind === "sales" ? "Invoices" : "Bills", align: "right", cell: (r) => r.count, value: (r) => r.count, total: docs.length },
    { header: "VAT", align: "right", cell: (r) => npr(r.tax), value: (r) => r.tax, total: npr(totals.tax) },
    { header: "Total", align: "right", cell: (r) => <span className="font-medium">{npr(r.total)}</span>, value: (r) => r.total, total: npr(totals.total) },
  ]

  const productRows = useMemo(() => {
    const m: Record<string, { name: string; unit: string; qty: number; amount: number }> = {}
    docs.forEach((d) => d.items.forEach((it) => {
      m[it.productId] ??= { name: it.name, unit: it.unit, qty: 0, amount: 0 }
      m[it.productId].qty += it.qty
      m[it.productId].amount += it.qty * it.rate - it.discount
    }))
    return Object.values(m).sort((a, b) => b.amount - a.amount)
  }, [docs])
  type ProdRow = (typeof productRows)[number]
  const productCols: RCol<ProdRow>[] = [
    { header: "Product", cell: (r) => r.name, value: (r) => r.name },
    { header: "Quantity", align: "right", cell: (r) => `${qty(round2(r.qty))} ${r.unit}`, value: (r) => r.qty },
    { header: "Avg. Rate", align: "right", cell: (r) => npr(r.amount / r.qty), value: (r) => round2(r.amount / r.qty) },
    { header: "Amount (excl. VAT)", align: "right", cell: (r) => <span className="font-medium">{npr(r.amount)}</span>, value: (r) => round2(r.amount), total: npr(sumBy(productRows, (r) => r.amount)) },
  ]

  const partyRows = useMemo(() => {
    const m: Record<string, { name: string; count: number; total: number; paid: number }> = {}
    docs.forEach((d) => {
      m[d.party] ??= { name: d.party, count: 0, total: 0, paid: 0 }
      m[d.party].count++
      m[d.party].total += d.total
      m[d.party].paid += Math.min(paid[d.id] ?? 0, d.total)
    })
    return Object.values(m).sort((a, b) => b.total - a.total)
  }, [docs, paid])
  type PartyRow = (typeof partyRows)[number]
  const partyCols: RCol<PartyRow>[] = [
    { header: kind === "sales" ? "Customer" : "Supplier", cell: (r) => r.name, value: (r) => r.name },
    { header: "Bills", align: "right", cell: (r) => r.count, value: (r) => r.count },
    { header: "Total", align: "right", cell: (r) => <span className="font-medium">{npr(r.total)}</span>, value: (r) => round2(r.total), total: npr(totals.total) },
    { header: "Paid", align: "right", cell: (r) => npr(r.paid), value: (r) => round2(r.paid), total: npr(totals.paid) },
    { header: "Due", align: "right", cell: (r) => <span className="text-destructive">{npr(r.total - r.paid)}</span>, value: (r) => round2(r.total - r.paid), total: npr(totals.total - totals.paid) },
  ]

  const onExport = () =>
    view === "doc" ? exportReport(`${kind}-report`, docCols, docs) : view === "period" ? exportReport(`${kind}-by-period`, periodCols, periodRows) : view === "product" ? exportReport(`${kind}-by-product`, productCols, productRows) : exportReport(`${kind}-by-party`, partyCols, partyRows)

  return (
    <ReportFrame
      title={`${label} Report`}
      description={kind === "sales" ? "Daily, weekly, monthly or custom-range sales." : "Purchases from suppliers over time."}
      range={range}
      onRange={setRange}
      search={q}
      onSearch={setQ}
      searchPlaceholder={`Search ${kind === "sales" ? "invoice, customer" : "bill, supplier"} or product`}
      onExport={onExport}
      filters={
        <>
          <SimpleSelect value={g} onChange={(v) => setG(v as Granularity)} className="sm:w-36" options={[{ value: "auto", label: "Auto period" }, { value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }]} />
          <Segmented value={view} onChange={setView} className="sm:ml-auto" options={[{ value: "doc", label: kind === "sales" ? "Invoices" : "Bills" }, { value: "period", label: "By Period" }, { value: "product", label: "By Product" }, { value: "party", label: kind === "sales" ? "By Customer" : "By Supplier" }]} />
        </>
      }
    >
      <SummaryGrid
        items={[
          { label: `Total ${label}`, value: npr(totals.total), tone: "primary" },
          { label: kind === "sales" ? "Invoices" : "Bills", value: docs.length },
          { label: "VAT Amount", value: npr(totals.tax) },
          { label: kind === "sales" ? "Received" : "Paid", value: npr(totals.paid), tone: "success" },
        ]}
      />
      <Panel title={`${label} trend`} description={`${gran[0].toUpperCase()}${gran.slice(1)} totals incl. VAT`} className="print:hidden">
        <TrendChart data={chart} series={[{ key: "v", name: label, color: kind === "sales" ? SERIES.sales : SERIES.purchase }]} height={220} />
      </Panel>
      {view === "doc" && <ReportTable cols={docCols} rows={docs.slice().reverse()} getKey={(d) => d.id} onRowClick={(d) => router.push(d.href)} />}
      {view === "period" && <ReportTable cols={periodCols} rows={periodRows} getKey={(r) => r.label} />}
      {view === "product" && <ReportTable cols={productCols} rows={productRows} getKey={(r) => r.name} />}
      {view === "party" && <ReportTable cols={partyCols} rows={partyRows} getKey={(r) => r.name} />}
    </ReportFrame>
  )
}

// ------------------------------------------------------------------ Profit & Loss
export function ProfitLossReport() {
  const invoices = useStore((s) => s.invoices)
  const purchases = useStore((s) => s.purchases)
  const moves = useStore((s) => s.stockMovements)
  const expenses = useStore((s) => s.expenses)
  const productions = useStore((s) => s.productions)
  const [range, setRange] = useState<DateRange>(rangeFor("30d"))

  const d = useMemo(() => {
    const inv = invoices.filter((i) => !i.cancelled && inRange(i.date, range))
    const sales = sumBy(inv, (i) => i.taxable)
    const discount = sumBy(inv, (i) => i.discount)
    const cogs = round2(moves.filter((m) => (m.type === "sale" || m.type === "sale_return") && inRange(m.date, range)).reduce((s, m) => s + -m.qty * m.rate, 0))
    const prodOverhead = sumBy(productions.filter((p) => p.status === "completed" && inRange(p.date, range)), (p) => p.overheadCost)
    const exp = expenses.filter((e) => inRange(e.date, range))
    const expByCat = EXPENSE_CATEGORIES.map((c) => ({ c, v: sumBy(exp.filter((e) => e.category === c), (e) => e.amount) })).filter((x) => x.v > 0)
    const totalExp = sumBy(exp, (e) => e.amount)
    const gross = round2(sales - cogs)
    const net = round2(gross - totalExp)
    const vatOut = sumBy(inv, (i) => i.tax)
    const vatIn = sumBy(purchases.filter((p) => !p.cancelled && inRange(p.date, range)), (p) => p.tax)
    return { sales, discount, cogs, gross, expByCat, totalExp, net, prodOverhead, vatOut, vatIn }
  }, [invoices, purchases, moves, expenses, productions, range])

  return (
    <ReportFrame
      title="Profit & Loss"
      description="Revenue minus cost of goods sold and expenses. Amounts exclude VAT."
      range={range}
      onRange={setRange}
      onExport={() =>
        exportReport("profit-loss", [{ header: "Particulars", cell: (r: [string, number]) => r[0], value: (r) => r[0] }, { header: "Amount", cell: (r) => r[1], value: (r) => r[1] }], [
          ["Sales (net of discount)", d.sales], ["Cost of Goods Sold", d.cogs], ["Gross Profit", d.gross], ...d.expByCat.map((x) => [x.c, x.v] as [string, number]), ["Total Expenses", d.totalExp], ["Net Profit", d.net],
        ])
      }
    >
      <SummaryGrid
        items={[
          { label: "Net Sales", value: npr(d.sales), tone: "primary" },
          { label: "Gross Profit", value: npr(d.gross), tone: d.gross >= 0 ? "success" : "danger" },
          { label: "Expenses", value: npr(d.totalExp), tone: "danger" },
          { label: "Net Profit", value: npr(d.net), tone: d.net >= 0 ? "success" : "danger" },
        ]}
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">Particulars</th>
                <th className="px-4 py-2 text-right font-semibold">Amount</th>
                <th className="px-4 py-2 text-right font-semibold">% of Sales</th>
              </tr>
            </thead>
            <tbody>
              <PLLine sales={d.sales} label="Sales (after discount)" value={d.sales} bold />
              <PLLine sales={d.sales} label="Less: Cost of Goods Sold" value={d.cogs} indent />
              <PLLine sales={d.sales} label="Gross Profit" value={d.gross} bold tone={d.gross >= 0 ? "success" : "danger"} />
              {d.expByCat.map((x) => <PLLine sales={d.sales} key={x.c} label={`Less: ${x.c}`} value={x.v} indent />)}
              <PLLine sales={d.sales} label="Total Expenses" value={d.totalExp} bold />
              <tr className="border-t-2 border-foreground/70 bg-muted/60 text-base font-bold">
                <td className="px-4 py-3">Net Profit</td>
                <td className={cn("num px-4 py-3 text-right", d.net >= 0 ? "text-success" : "text-destructive")}>{npr(d.net)}</td>
                <td className="num px-4 py-3 text-right text-xs">{d.sales ? `${((d.net / d.sales) * 100).toFixed(1)}%` : "—"}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="space-y-4">
          <Panel title="VAT Summary">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Output VAT (sales)</span><span className="num">{npr(d.vatOut)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Input VAT (purchase)</span><span className="num">{npr(d.vatIn)}</span></div>
              <div className="flex justify-between border-t pt-2 font-semibold"><span>{d.vatOut >= d.vatIn ? "VAT payable to IRD" : "VAT credit"}</span><span className="num">{npr(Math.abs(d.vatOut - d.vatIn))}</span></div>
            </div>
          </Panel>
          <Panel title="Notes">
            <p className="text-xs text-muted-foreground">
              Sales are shown after {npr(d.discount)} discount given. Cost of goods sold is calculated from the cost price of each item at the time of sale (including production cost for manufactured goods,
              which already includes {npr(d.prodOverhead)} labour & overhead this period).
            </p>
          </Panel>
        </div>
      </div>
    </ReportFrame>
  )
}

function PLLine({ label, value, bold, indent, tone, sales }: { label: string; value: number; bold?: boolean; indent?: boolean; tone?: "success" | "danger"; sales: number }) {
  return (
    <tr className={cn("border-t", bold && "bg-muted/40 font-semibold")}>
      <td className={cn("px-4 py-2.5", indent && "pl-8 text-muted-foreground")}>{label}</td>
      <td className={cn("num px-4 py-2.5 text-right", tone === "success" && "text-success", tone === "danger" && "text-destructive")}>{npr(value)}</td>
      <td className="num w-24 px-4 py-2.5 text-right text-xs text-muted-foreground">{bold && sales ? `${((value / sales) * 100).toFixed(1)}%` : ""}</td>
    </tr>
  )
}

// ------------------------------------------------------------------ Payments
export function PaymentReport() {
  const payments = useStore((s) => s.payments)
  const partyMap = usePartyMap()
  const [range, setRange] = useState<DateRange>(rangeFor("30d"))
  const [q, setQ] = useState("")
  const [dir, setDir] = useState<"all" | "in" | "out">("all")
  const [method, setMethod] = useState("all")

  const rows = useMemo(
    () =>
      payments
        .filter((p) => inRange(p.date, range) && (dir === "all" || p.direction === dir) && (method === "all" || p.method === method))
        .map((p) => ({ ...p, party: p.partyId ? partyMap[p.partyId]?.name ?? "" : "Cash Sale (Walk-in)" }))
        .filter((p) => !q || has(p.party, q) || has(p.number, q) || has(p.reference ?? "", q))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [payments, range, dir, method, q, partyMap],
  )
  type Row = (typeof rows)[number]
  const inT = sumBy(rows.filter((r) => r.direction === "in"), (r) => r.amount)
  const outT = sumBy(rows.filter((r) => r.direction === "out"), (r) => r.amount)
  const byMethod = PAYMENT_METHODS.filter((m) => m.value !== "credit").map((m) => ({ label: m.label, value: sumBy(rows.filter((r) => r.method === m.value && r.direction === "in"), (r) => r.amount) })).filter((x) => x.value > 0)

  const cols: RCol<Row>[] = [
    { header: "Date", cell: (r) => fmtDate(r.date), value: (r) => r.date },
    { header: "Receipt No.", cell: (r) => <span className="font-medium">{r.number}</span>, value: (r) => r.number },
    { header: "Party", cell: (r) => <span className="block max-w-56 truncate">{r.party}</span>, value: (r) => r.party },
    { header: "Type", cell: (r) => <StatusBadge label={r.direction === "in" ? "Received" : "Paid"} tone={r.direction === "in" ? "green" : "amber"} />, value: (r) => (r.direction === "in" ? "Received" : "Paid") },
    { header: "Method", cell: (r) => methodLabel(r.method), value: (r) => methodLabel(r.method) },
    { header: "Reference", cell: (r) => <span className="text-muted-foreground">{r.reference ?? "—"}</span>, value: (r) => r.reference ?? "" },
    { header: "Received", align: "right", cell: (r) => (r.direction === "in" ? <span className="text-success">{npr(r.amount)}</span> : ""), value: (r) => (r.direction === "in" ? r.amount : 0), total: npr(inT) },
    { header: "Paid", align: "right", cell: (r) => (r.direction === "out" ? <span className="text-destructive">{npr(r.amount)}</span> : ""), value: (r) => (r.direction === "out" ? r.amount : 0), total: npr(outT) },
  ]

  return (
    <ReportFrame
      title="Payment Report"
      description="All money received and paid, by method."
      range={range}
      onRange={setRange}
      search={q}
      onSearch={setQ}
      searchPlaceholder="Search party, receipt, reference"
      onExport={() => exportReport("payment-report", cols, rows)}
      filters={
        <>
          <SimpleSelect value={dir} onChange={(v) => setDir(v as "in")} className="sm:w-36" options={[{ value: "all", label: "In & Out" }, { value: "in", label: "Received" }, { value: "out", label: "Paid" }]} />
          <SimpleSelect value={method} onChange={setMethod} className="sm:w-36" options={[{ value: "all", label: "All methods" }, ...PAYMENT_METHODS.filter((m) => m.value !== "credit").map((m) => ({ value: m.value, label: m.label }))]} />
        </>
      }
    >
      <SummaryGrid items={[{ label: "Received", value: npr(inT), tone: "success" }, { label: "Paid", value: npr(outT), tone: "danger" }, { label: "Net", value: npr(inT - outT), tone: "primary" }, { label: "Transactions", value: rows.length }]} />
      {byMethod.length > 0 && (
        <Panel title="Receipts by payment method" className="print:hidden">
          <HBarChart data={byMethod} name="Received" color={SERIES.third} />
        </Panel>
      )}
      <ReportTable cols={cols} rows={rows} getKey={(r) => r.id} />
    </ReportFrame>
  )
}

// ------------------------------------------------------------------ Expense
export function ExpenseReport() {
  const expenses = useStore((s) => s.expenses)
  const [range, setRange] = useState<DateRange>(rangeFor("90d"))
  const [q, setQ] = useState("")
  const [cat, setCat] = useState("all")
  const rows = useMemo(
    () => expenses.filter((e) => inRange(e.date, range) && (cat === "all" || e.category === cat) && (!q || has(e.description, q) || has(e.paidTo ?? "", q))).sort((a, b) => b.date.localeCompare(a.date)),
    [expenses, range, cat, q],
  )
  type Row = (typeof rows)[number]
  const total = sumBy(rows, (r) => r.amount)
  const byCat = EXPENSE_CATEGORIES.map((c) => ({ label: c, value: sumBy(rows.filter((r) => r.category === c), (r) => r.amount) })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value)
  const cols: RCol<Row>[] = [
    { header: "Date", cell: (r) => fmtDate(r.date), value: (r) => r.date },
    { header: "Category", cell: (r) => r.category, value: (r) => r.category },
    { header: "Description", cell: (r) => <span className="block max-w-72 truncate">{r.description}</span>, value: (r) => r.description },
    { header: "Paid To", cell: (r) => r.paidTo ?? "—", value: (r) => r.paidTo ?? "" },
    { header: "Method", cell: (r) => methodLabel(r.method), value: (r) => methodLabel(r.method) },
    { header: "Amount", align: "right", cell: (r) => <span className="font-medium">{npr(r.amount)}</span>, value: (r) => r.amount, total: npr(total) },
  ]
  return (
    <ReportFrame
      title="Expense Report"
      description="Business expenses by category."
      range={range}
      onRange={setRange}
      search={q}
      onSearch={setQ}
      searchPlaceholder="Search description or payee"
      onExport={() => exportReport("expense-report", cols, rows)}
      filters={<SimpleSelect value={cat} onChange={setCat} className="sm:w-44" options={[{ value: "all", label: "All categories" }, ...EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))]} />}
    >
      <SummaryGrid items={[{ label: "Total Expenses", value: npr(total), tone: "danger" }, { label: "Entries", value: rows.length }, { label: "Top Category", value: byCat[0]?.label ?? "—" }, { label: "Top Category Amount", value: npr(byCat[0]?.value ?? 0) }]} />
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Panel title="By category" className="self-start">
          {byCat.length ? <HBarChart data={byCat} name="Expense" color={SERIES.purchase} /> : <div className="py-6 text-center text-sm text-muted-foreground">No data</div>}
        </Panel>
        <ReportTable cols={cols} rows={rows} getKey={(r) => r.id} />
      </div>
    </ReportFrame>
  )
}
