"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ArrowDownLeft, ArrowUpRight, Download, FileText, Mail, MapPin, Pencil, Phone, Printer, ShoppingCart, Truck, UserX } from "lucide-react"
import { downloadCSV, fmtDate, methodLabel, npr } from "@/lib/format"
import { docStatus, partyLedger } from "@/lib/ledger"
import { useDocPaid, usePartySummaries } from "@/lib/hooks"
import { useStore } from "@/lib/store"
import { useUI } from "@/lib/ui-store"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DataTable } from "@/components/shared/data-table"
import { DateRangeFilter, FilterBar, rangeFor, type DateRange } from "@/components/shared/filters"
import { EmptyState, KeyValue, Money, PageHeader, Panel, StatCard } from "@/components/shared/ui-bits"
import { StatusBadge } from "@/components/shared/status-badge"
import { StatementDocument } from "@/components/shared/statement-document"

const drcr = (v: number) => (Math.abs(v) < 0.5 ? "NPR 0" : `${npr(Math.abs(v))} ${v > 0 ? "Dr" : "Cr"}`)

export default function PartyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const party = useStore((s) => s.parties.find((p) => p.id === id))
  const business = useStore((s) => s.business)
  const invoices = useStore((s) => s.invoices)
  const purchases = useStore((s) => s.purchases)
  const payments = useStore((s) => s.payments)
  const openDialog = useUI((s) => s.openDialog)
  const summaries = usePartySummaries()
  const paid = useDocPaid()
  const [range, setRange] = useState<DateRange>(rangeFor("all"))

  const ledger = useMemo(
    () => (party ? partyLedger(party, { invoices, purchases, payments }, range.preset === "all" ? undefined : range.from, range.preset === "all" ? undefined : range.to) : null),
    [party, invoices, purchases, payments, range],
  )
  const partyPayments = useMemo(() => payments.filter((p) => p.partyId === id).sort((a, b) => b.date.localeCompare(a.date)), [payments, id])
  const partyInvoices = useMemo(() => invoices.filter((i) => i.partyId === id).reverse(), [invoices, id])
  const partyPurchases = useMemo(() => purchases.filter((i) => i.partyId === id).reverse(), [purchases, id])

  if (!party || !ledger) return <EmptyState icon={UserX} title="Party not found" action={<Button render={<Link href="/parties" />} nativeButton={false}>Back to parties</Button>} />

  const s = summaries[party.id]
  const isCustomer = party.type !== "supplier"
  const isSupplier = party.type !== "customer"
  const creditUsed = party.creditLimit > 0 ? Math.min(100, (Math.max(0, s.balance) / party.creditLimit) * 100) : 0
  const stmtFrom = range.preset === "all" ? party.createdAt.slice(0, 10) : range.from
  const stmtTo = range.preset === "all" ? new Date().toISOString().slice(0, 10) : range.to

  const exportLedger = () =>
    downloadCSV(`statement-${party.name}`, [
      ["Date", "Particulars", "Ref", "Debit", "Credit", "Balance"],
      ["", "Opening Balance", "", "", "", ledger.opening],
      ...ledger.rows.map((r) => [r.date, r.type, r.ref, r.debit, r.credit, r.balance]),
    ])

  return (
    <div>
      <PageHeader
        back="/parties"
        title={
          <span className="flex flex-wrap items-center gap-2">
            {party.name} <StatusBadge status={party.type} /> {party.status === "inactive" && <StatusBadge status="inactive" />}
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="flex items-center gap-1"><Phone className="size-3.5" /> {party.phone}</span>
            <span className="flex items-center gap-1"><MapPin className="size-3.5" /> {party.address}</span>
            {party.email && <span className="flex items-center gap-1"><Mail className="size-3.5" /> {party.email}</span>}
          </span>
        }
        actions={
          <>
            {isCustomer && <Button className="h-9" render={<Link href={`/sales?party=${party.id}`} />} nativeButton={false}><ShoppingCart /> New Sale</Button>}
            {isSupplier && <Button variant={isCustomer ? "outline" : "default"} className="h-9" render={<Link href={`/purchases/new?party=${party.id}`} />} nativeButton={false}><Truck /> New Purchase</Button>}
            {isCustomer && <Button variant="outline" className="h-9" onClick={() => openDialog({ kind: "payment", direction: "in", partyId: party.id })}><ArrowDownLeft /> Receive Payment</Button>}
            {isSupplier && <Button variant="outline" className="h-9" onClick={() => openDialog({ kind: "payment", direction: "out", partyId: party.id })}><ArrowUpRight /> Give Payment</Button>}
            <Button variant="outline" className="h-9" onClick={() => window.print()}><Printer /> Print Statement</Button>
            <Button variant="ghost" size="icon" className="size-9" onClick={() => openDialog({ kind: "party", party })} aria-label="Edit party"><Pencil /></Button>
          </>
        }
      />

      <div className="print:hidden">
        <div className="mb-4 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Current Balance"
            value={<span className={s.balance > 0.5 ? "text-success" : s.balance < -0.5 ? "text-destructive" : ""}>{npr(Math.abs(s.balance))}</span>}
            hint={s.balance > 0.5 ? "Party owes you (To Receive)" : s.balance < -0.5 ? "You owe party (To Pay)" : "All settled"}
            tone={s.balance > 0.5 ? "success" : s.balance < -0.5 ? "danger" : "default"}
          />
          <StatCard label="Total Sales" value={npr(s.sales)} hint={`${partyInvoices.filter((i) => !i.cancelled).length} invoices`} />
          <StatCard label="Total Purchase" value={npr(s.purchase)} hint={`${partyPurchases.filter((i) => !i.cancelled).length} bills`} />
          <StatCard label="Payments" value={npr(s.received + s.paid)} hint={`Received ${npr(s.received)} · Paid ${npr(s.paid)}`} />
        </div>

        <div className="grid gap-4 xl:grid-cols-[300px_1fr]">
          <Panel title="Overview">
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-1">
              <KeyValue label="Party Name" value={party.name} />
              <KeyValue label="Phone" value={party.phone} />
              <KeyValue label="Address" value={party.address} />
              <KeyValue label="PAN / VAT" value={party.pan} />
              <KeyValue label="Opening Balance" value={drcr(party.openingBalance)} />
              <KeyValue label="Current Balance" value={<Money value={s.balance} kind="balance" />} />
              <KeyValue label="Credit Limit" value={party.creditLimit ? npr(party.creditLimit) : "Not set"} />
              <KeyValue label="Last Transaction" value={s.lastTxn ? fmtDate(s.lastTxn) : "—"} />
            </div>
            {party.creditLimit > 0 && (
              <div className="mt-4">
                <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                  <span>Credit used</span>
                  <span>{Math.round(creditUsed)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className={cn("h-full rounded-full", creditUsed > 90 ? "bg-destructive" : creditUsed > 70 ? "bg-warning" : "bg-success")} style={{ width: `${creditUsed}%` }} />
                </div>
              </div>
            )}
          </Panel>

          <div className="min-w-0">
            <Tabs defaultValue="ledger">
              <TabsList variant="line" className="mb-2 w-full justify-start overflow-x-auto overflow-y-hidden border-b pb-1.5 group-data-horizontal/tabs:h-auto">
                <TabsTrigger value="ledger" className="flex-none px-3">Transaction History</TabsTrigger>
                <TabsTrigger value="payments" className="flex-none px-3">Payments ({partyPayments.length})</TabsTrigger>
                {isCustomer && <TabsTrigger value="sales" className="flex-none px-3">Sales ({partyInvoices.length})</TabsTrigger>}
                {isSupplier && <TabsTrigger value="purchases" className="flex-none px-3">Purchases ({partyPurchases.length})</TabsTrigger>}
              </TabsList>

              <TabsContent value="ledger">
                <FilterBar>
                  <DateRangeFilter value={range} onChange={setRange} />
                  <Button variant="outline" className="h-9 sm:ml-auto" onClick={exportLedger}><Download /> Download Statement</Button>
                </FilterBar>
                <div className="overflow-hidden rounded-lg border bg-card">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px] text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50 text-xs text-muted-foreground uppercase">
                          <th className="px-3 py-2 text-left font-semibold">Date</th>
                          <th className="px-3 py-2 text-left font-semibold">Invoice / Ref</th>
                          <th className="px-3 py-2 text-left font-semibold">Transaction Type</th>
                          <th className="px-3 py-2 text-right font-semibold">Debit</th>
                          <th className="px-3 py-2 text-right font-semibold">Credit</th>
                          <th className="px-3 py-2 text-right font-semibold">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b bg-muted/20 font-medium">
                          <td className="px-3 py-2 text-muted-foreground">{range.preset === "all" ? "—" : fmtDate(range.from)}</td>
                          <td className="px-3 py-2" colSpan={4}>Opening Balance</td>
                          <td className="num px-3 py-2 text-right">{drcr(ledger.opening)}</td>
                        </tr>
                        {[...ledger.rows].reverse().map((r, i) => (
                          <tr key={i} className={cn("border-b last:border-0 hover:bg-muted/40", r.href && "cursor-pointer")} onClick={() => r.href && router.push(r.href)}>
                            <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.date)}</td>
                            <td className="px-3 py-2 font-medium whitespace-nowrap text-primary">{r.ref}</td>
                            <td className="px-3 py-2">
                              <StatusBadge label={r.type} tone={r.type === "Sale" ? "blue" : r.type === "Purchase" ? "violet" : r.type === "Payment Received" ? "green" : "amber"} />
                            </td>
                            <td className="num px-3 py-2 text-right">{r.debit ? npr(r.debit) : ""}</td>
                            <td className="num px-3 py-2 text-right">{r.credit ? npr(r.credit) : ""}</td>
                            <td className={cn("num px-3 py-2 text-right font-medium", r.balance > 0.5 ? "text-success" : r.balance < -0.5 ? "text-destructive" : "")}>{drcr(r.balance)}</td>
                          </tr>
                        ))}
                        {ledger.rows.length === 0 && (
                          <tr><td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">No transactions in this period.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-between border-t bg-muted/40 px-3 py-2 text-sm font-semibold">
                    <span>Closing Balance</span>
                    <span className="num">{drcr(ledger.closing)}</span>
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Dr = party owes you · Cr = you owe the party. Newest transactions first.</p>
              </TabsContent>

              <TabsContent value="payments">
                <DataTable
                  rows={partyPayments}
                  getRowId={(r) => r.id}
                  pageSize={10}
                  emptyTitle="No payments yet"
                  emptyDescription="Payments received or given will appear here."
                  columns={[
                    { key: "number", header: "Receipt No.", cell: (r) => <span className="font-medium">{r.number}</span> },
                    { key: "date", header: "Date", cell: (r) => fmtDate(r.date) },
                    { key: "dir", header: "Type", cell: (r) => <StatusBadge label={r.direction === "in" ? "Received" : "Paid"} tone={r.direction === "in" ? "green" : "amber"} /> },
                    { key: "method", header: "Method", cell: (r) => methodLabel(r.method) },
                    { key: "ref", header: "Reference", cell: (r) => <span className="text-muted-foreground">{r.reference ?? "—"}</span> },
                    { key: "amount", header: "Amount", align: "right", cell: (r) => <Money value={r.amount} className="font-medium" /> },
                  ]}
                />
              </TabsContent>

              <TabsContent value="sales">
                <DataTable
                  rows={partyInvoices}
                  getRowId={(r) => r.id}
                  pageSize={10}
                  onRowClick={(r) => router.push(`/invoices/${r.id}`)}
                  emptyTitle="No sales yet"
                  emptyAction={<Button render={<Link href={`/sales?party=${party.id}`} />} nativeButton={false}><FileText /> Create Invoice</Button>}
                  columns={[
                    { key: "number", header: "Invoice", cell: (r) => <span className="font-medium text-primary">{r.number}</span> },
                    { key: "date", header: "Date", cell: (r) => fmtDate(r.date) },
                    { key: "total", header: "Amount", align: "right", cell: (r) => <Money value={r.total} /> },
                    { key: "paid", header: "Paid", align: "right", cell: (r) => <Money value={Math.min(paid[r.id] ?? 0, r.total)} /> },
                    { key: "due", header: "Due", align: "right", cell: (r) => <Money value={r.cancelled ? 0 : Math.max(0, r.total - (paid[r.id] ?? 0))} kind="due" /> },
                    { key: "status", header: "Status", cell: (r) => <StatusBadge status={docStatus(r.total, paid[r.id] ?? 0, r.cancelled)} /> },
                  ]}
                />
              </TabsContent>

              <TabsContent value="purchases">
                <DataTable
                  rows={partyPurchases}
                  getRowId={(r) => r.id}
                  pageSize={10}
                  onRowClick={(r) => router.push(`/purchases/${r.id}`)}
                  emptyTitle="No purchases yet"
                  emptyAction={<Button render={<Link href={`/purchases/new?party=${party.id}`} />} nativeButton={false}><Truck /> New Purchase</Button>}
                  columns={[
                    { key: "number", header: "Purchase", cell: (r) => <span className="font-medium text-primary">{r.number}</span> },
                    { key: "bill", header: "Supplier Bill", cell: (r) => r.supplierBillNo || "—" },
                    { key: "date", header: "Date", cell: (r) => fmtDate(r.date) },
                    { key: "total", header: "Amount", align: "right", cell: (r) => <Money value={r.total} /> },
                    { key: "due", header: "Due", align: "right", cell: (r) => <Money value={r.cancelled ? 0 : Math.max(0, r.total - (paid[r.id] ?? 0))} kind="due" /> },
                    { key: "status", header: "Status", cell: (r) => <StatusBadge status={docStatus(r.total, paid[r.id] ?? 0, r.cancelled)} /> },
                  ]}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      <StatementDocument className="hidden print:block" business={business} party={party} rows={ledger.rows} opening={ledger.opening} closing={ledger.closing} from={stmtFrom} to={stmtTo} />
    </div>
  )
}
