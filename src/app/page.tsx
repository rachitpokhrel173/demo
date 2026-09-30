"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import {
  AlertTriangle, ArrowDownLeft, ArrowRight, ArrowUpRight, Boxes, Clock, FileText, ShoppingCart, Truck, Wallet,
} from "lucide-react"
import { bucketize, type Granularity } from "@/lib/analytics"
import { fmtDate, npr, qty, todayISO } from "@/lib/format"
import { QUICK_ACTIONS } from "@/lib/nav"
import { stockValue, sumBy } from "@/lib/ledger"
import { useInvoicePaid, usePartyMap, usePartySummaries, useProductMap, useStockMap } from "@/lib/hooks"
import { useStore } from "@/lib/store"
import { useUI } from "@/lib/ui-store"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { PageHeader, Panel, StatCard } from "@/components/shared/ui-bits"
import { Segmented } from "@/components/shared/filters"
import { HBarChart, SERIES, TrendChart } from "@/components/shared/charts"
import { StatusBadge } from "@/components/shared/status-badge"

export default function DashboardPage() {
  const router = useRouter()
  const openDialog = useUI((s) => s.openDialog)
  const invoices = useStore((s) => s.invoices)
  const purchases = useStore((s) => s.purchases)
  const payments = useStore((s) => s.payments)
  const expenses = useStore((s) => s.expenses)
  const products = useStore((s) => s.products)
  const moves = useStore((s) => s.stockMovements)
  const users = useStore((s) => s.users)
  const stock = useStockMap()
  const summaries = usePartySummaries()
  const paid = useInvoicePaid()
  const partyMap = usePartyMap()
  const productMap = useProductMap()
  const [salesG, setSalesG] = useState<Granularity>("daily")
  const [purG, setPurG] = useState<Granularity>("weekly")

  const today = todayISO()
  const k = useMemo(() => {
    const inv = invoices.filter((i) => !i.cancelled)
    const pur = purchases.filter((p) => !p.cancelled)
    const todayInv = inv.filter((i) => i.date === today)
    const bal = Object.values(summaries).map((s) => s.balance)
    const pending = inv.filter((i) => i.total - (paid[i.id] ?? 0) > 0.5)
    const low = products.filter((p) => p.status === "active" && (stock[p.id] ?? 0) <= p.minStock)
    return {
      todaySales: sumBy(todayInv, (i) => i.total),
      todayInvoices: todayInv.length,
      todayPurchase: sumBy(pur.filter((p) => p.date === today), (p) => p.total),
      todayPurchaseCount: pur.filter((p) => p.date === today).length,
      receivable: sumBy(bal.filter((b) => b > 0), (b) => b),
      payable: -sumBy(bal.filter((b) => b < 0), (b) => b),
      receivableCount: bal.filter((b) => b > 0.5).length,
      payableCount: bal.filter((b) => b < -0.5).length,
      stockValue: stockValue(products, stock),
      low,
      pendingCount: pending.length,
      pendingAmount: sumBy(pending, (i) => i.total - (paid[i.id] ?? 0)),
      todayReceived: sumBy(payments.filter((p) => p.date === today && p.direction === "in"), (p) => p.amount),
    }
  }, [invoices, purchases, payments, products, stock, summaries, paid, today])

  const salesData = useMemo(
    () => bucketize(invoices.filter((i) => !i.cancelled).map((i) => ({ date: i.date, amount: i.total })), salesG).map((b) => ({ label: b.label, sales: b.value })),
    [invoices, salesG],
  )
  const purchaseData = useMemo(
    () => bucketize(purchases.filter((i) => !i.cancelled).map((i) => ({ date: i.date, amount: i.total })), purG).map((b) => ({ label: b.label, purchase: b.value })),
    [purchases, purG],
  )

  const stockByCategory = useMemo(() => {
    const m: Record<string, number> = {}
    products.forEach((p) => (m[p.category] = (m[p.category] ?? 0) + Math.max(0, stock[p.id] ?? 0) * p.purchasePrice))
    return Object.entries(m).map(([label, value]) => ({ label, value: Math.round(value) })).sort((a, b) => b.value - a.value)
  }, [products, stock])

  const movement7 = useMemo(() => {
    const d = bucketize([], "daily", 7)
    const idx = Object.fromEntries(d.map((b, i) => [b.key, i]))
    const rows = d.map((b) => ({ label: b.label, in: 0, out: 0 }))
    for (const m of moves) {
      if (!(m.date in idx) || m.type === "opening") continue
      const v = Math.abs(m.qty) * (productMap[m.productId]?.purchasePrice ?? 0)
      if (m.qty > 0) rows[idx[m.date]].in += v
      else rows[idx[m.date]].out += v
    }
    return rows.map((r) => ({ ...r, in: Math.round(r.in), out: Math.round(r.out) }))
  }, [moves, productMap])

  const topDebtors = useMemo(
    () => Object.entries(summaries).filter(([, s]) => s.balance > 0.5).sort((a, b) => b[1].balance - a[1].balance).slice(0, 5),
    [summaries],
  )

  const recent = useMemo(() => {
    type Row = { id: string; date: string; at: string; type: string; tone: "blue" | "violet" | "green" | "amber" | "gray"; ref: string; party: string; amount: number; href: string }
    const rows: Row[] = []
    invoices.slice(-12).forEach((i) => rows.push({ id: i.id, date: i.date, at: i.createdAt, type: "Sale", tone: "blue", ref: i.number, party: i.customerName, amount: i.total, href: `/invoices/${i.id}` }))
    purchases.slice(-8).forEach((p) => rows.push({ id: p.id, date: p.date, at: p.createdAt, type: "Purchase", tone: "violet", ref: p.number, party: partyMap[p.partyId]?.name ?? "", amount: p.total, href: `/purchases/${p.id}` }))
    payments.slice(-12).filter((p) => !p.invoiceId && !p.purchaseId).forEach((p) => rows.push({ id: p.id, date: p.date, at: p.date + "T23:00", type: p.direction === "in" ? "Payment In" : "Payment Out", tone: p.direction === "in" ? "green" : "amber", ref: p.number, party: p.partyId ? partyMap[p.partyId]?.name ?? "" : "Walk-in", amount: p.amount, href: `/payments?tab=${p.direction}&q=${p.number}` }))
    expenses.slice(-5).forEach((e) => rows.push({ id: e.id, date: e.date, at: e.date + "T12:00", type: "Expense", tone: "gray", ref: e.category, party: e.paidTo ?? e.description, amount: e.amount, href: "/expenses" }))
    return rows.sort((a, b) => b.date.localeCompare(a.date) || b.at.localeCompare(a.at)).slice(0, 9)
  }, [invoices, purchases, payments, expenses, partyMap])

  const firstName = users[0]?.name.split(" ")[0] ?? "Admin"
  const totalRP = k.receivable + k.payable || 1

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Namaste, ${firstName}`}
        description={`Here is how your business is doing today — ${format(new Date(), "EEEE, dd MMMM yyyy")}`}
        actions={
          <>
            <Button variant="outline" className="h-9" render={<Link href="/purchases/new" />} nativeButton={false}>
              <Truck /> New Purchase
            </Button>
            <Button className="h-9" render={<Link href="/sales" />} nativeButton={false}>
              <ShoppingCart /> New Sale
            </Button>
          </>
        }
      />

      {/* Quick actions */}
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
        {QUICK_ACTIONS.map((a) => (
          <button
            key={a.label}
            type="button"
            onClick={() => (a.href ? router.push(a.href) : a.dialog && openDialog(a.dialog))}
            className="group flex flex-col items-center gap-2 rounded-lg border bg-card px-1 py-3 text-center shadow-xs transition-colors hover:border-primary/40 hover:bg-primary/[0.02]"
          >
            <span className={cn("flex size-9 items-center justify-center rounded-md", a.tone)}>
              <a.icon className="size-4.5" />
            </span>
            <span className="text-[11px] leading-tight font-medium sm:text-xs">{a.label}</span>
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Today's Sales" value={npr(k.todaySales)} icon={ShoppingCart} tone="primary" hint={`${k.todayInvoices} invoices · ${npr(k.todayReceived)} received`} href="/invoices" />
        <StatCard label="Today's Purchase" value={npr(k.todayPurchase)} icon={Truck} tone="default" hint={`${k.todayPurchaseCount} purchase bills`} href="/purchases" />
        <StatCard label="Total Receivable" value={npr(k.receivable)} icon={ArrowDownLeft} tone="success" hint={`From ${k.receivableCount} parties`} href="/reports?r=outstanding" />
        <StatCard label="Total Payable" value={npr(k.payable)} icon={ArrowUpRight} tone="danger" hint={`To ${k.payableCount} parties`} href="/reports?r=outstanding" />
        <StatCard label="Current Stock Value" value={npr(k.stockValue)} icon={Boxes} tone="primary" hint={`${products.length} products at cost`} href="/inventory" />
        <StatCard label="Low Stock Items" value={k.low.length} icon={AlertTriangle} tone={k.low.length ? "warning" : "success"} hint={k.low.length ? k.low.slice(0, 2).map((p) => p.name.split(" —")[0]).join(", ") : "All items are well stocked"} href="/inventory?filter=low" />
        <StatCard label="Today's Invoices" value={k.todayInvoices} icon={FileText} hint="Bills generated today" href="/invoices" />
        <StatCard label="Pending Payments" value={npr(k.pendingAmount)} icon={Clock} tone="warning" hint={`${k.pendingCount} unpaid / partial invoices`} href="/invoices?status=due" />
      </div>

      {/* Sales overview + receivable vs payable */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="Sales Overview"
          description="Invoice value including VAT"
          actions={<Segmented value={salesG} onChange={setSalesG} options={[{ value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }]} />}
        >
          <TrendChart data={salesData} series={[{ key: "sales", name: "Sales", color: SERIES.sales }]} type="bar" />
        </Panel>
        <Panel title="Receivables vs Payables" description="Money to collect vs money to pay">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-muted-foreground">To Receive</div>
              <div className="num text-lg font-semibold text-success">{npr(k.receivable)}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">To Pay</div>
              <div className="num text-lg font-semibold text-destructive">{npr(k.payable)}</div>
            </div>
          </div>
          <div className="mt-3 flex h-2.5 gap-0.5 overflow-hidden rounded-full">
            <div style={{ width: `${(k.receivable / totalRP) * 100}%`, background: SERIES.receivable }} />
            <div style={{ width: `${(k.payable / totalRP) * 100}%`, background: SERIES.payable }} />
          </div>
          <div className="mt-1.5 text-xs text-muted-foreground">
            Net position: <b className={k.receivable - k.payable >= 0 ? "text-success" : "text-destructive"}>{npr(k.receivable - k.payable)}</b>
          </div>
          <div className="mt-4 mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Top receivables</div>
          <ul className="space-y-1">
            {topDebtors.map(([id, s]) => (
              <li key={id}>
                <Link href={`/parties/${id}`} className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                  <span className="truncate">{partyMap[id]?.name}</span>
                  <span className="num font-medium">{npr(s.balance)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {/* Purchase + stock */}
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Panel title="Purchase Overview" description="Purchase bills including VAT" actions={<Segmented value={purG} onChange={setPurG} options={[{ value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }]} />}>
          <TrendChart data={purchaseData} series={[{ key: "purchase", name: "Purchase", color: SERIES.purchase }]} type="bar" height={220} />
        </Panel>
        <Panel title="Stock Overview" description={`Stock value by category · Total ${npr(k.stockValue)}`}>
          <HBarChart data={stockByCategory} name="Stock value" height={220} />
        </Panel>
        <Panel title="Stock Movement" description="Value of stock in vs out — last 7 days" className="lg:col-span-2 xl:col-span-1">
          <TrendChart
            data={movement7}
            series={[{ key: "in", name: "Stock In", color: SERIES.sales }, { key: "out", name: "Stock Out", color: SERIES.purchase }]}
            height={220}
          />
        </Panel>
      </div>

      {/* Recent + low stock */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="Recent Transactions"
          bodyClassName="p-0"
          actions={<Button variant="ghost" size="sm" render={<Link href="/reports?r=payments" />} nativeButton={false}>View all <ArrowRight /></Button>}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-xs text-muted-foreground uppercase">
                  <th className="px-4 py-2 text-left font-semibold">Date</th>
                  <th className="px-4 py-2 text-left font-semibold">Type</th>
                  <th className="px-4 py-2 text-left font-semibold">Ref</th>
                  <th className="px-4 py-2 text-left font-semibold">Party</th>
                  <th className="px-4 py-2 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.type + r.id} className="cursor-pointer border-b last:border-0 hover:bg-muted/40" onClick={() => router.push(r.href)}>
                    <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">{r.date === today ? "Today" : fmtDate(r.date, "dd MMM")}</td>
                    <td className="px-4 py-2.5"><StatusBadge label={r.type} tone={r.tone} /></td>
                    <td className="px-4 py-2.5 font-medium whitespace-nowrap">{r.ref}</td>
                    <td className="max-w-56 truncate px-4 py-2.5">{r.party}</td>
                    <td className="num px-4 py-2.5 text-right font-medium whitespace-nowrap">{npr(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="Low Stock Alerts" bodyClassName="p-0" actions={<Button variant="ghost" size="sm" render={<Link href="/inventory?filter=low" />} nativeButton={false}>Inventory <ArrowRight /></Button>}>
          {k.low.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">All products are above minimum stock.</div>
          ) : (
            <ul className="divide-y">
              {k.low.map((p) => {
                const q = stock[p.id] ?? 0
                return (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <Link href={`/products/${p.id}`} className="min-w-0">
                      <div className="truncate text-sm font-medium hover:underline">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {qty(q)} {p.unit} left · min {p.minStock}
                      </div>
                    </Link>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge status={q <= 0 ? "out" : "low"} />
                      <Button size="xs" variant="outline" render={<Link href={`/purchases/new?product=${p.id}`} />} nativeButton={false}>
                        Reorder
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          <div className="border-t px-4 py-3">
            <button type="button" className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline" onClick={() => openDialog({ kind: "payment", direction: "in" })}>
              <Wallet className="size-3.5" /> Record a customer payment
            </button>
          </div>
        </Panel>
      </div>
    </div>
  )
}
