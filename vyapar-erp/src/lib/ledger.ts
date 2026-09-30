// Pure functions that derive balances, stock and ledgers from raw records.
// Keeping these pure means the same logic can run on a server later.
import { round2 } from "./format"
import type { DataState } from "./seed"
import type { ID, Invoice, Party, Payment, Product, Purchase, StockMovement } from "./types"

export type DocStatus = "paid" | "partial" | "due" | "cancelled"

export function stockMap(moves: StockMovement[]) {
  const m: Record<ID, number> = {}
  for (const mv of moves) m[mv.productId] = round2((m[mv.productId] ?? 0) + mv.qty)
  return m
}

export function stockStatus(p: Product, qty: number): "in" | "low" | "out" {
  if (qty <= 0) return "out"
  if (qty <= p.minStock) return "low"
  return "in"
}

/** Amount paid against each invoice / purchase id (direct payments + FIFO allocations). */
export function paidMap(payments: Payment[]) {
  const m: Record<ID, number> = {}
  for (const p of payments) {
    const k = p.invoiceId ?? p.purchaseId
    if (k) m[k] = round2((m[k] ?? 0) + p.amount)
    for (const a of p.allocations ?? []) m[a.docId] = round2((m[a.docId] ?? 0) + a.amount)
  }
  return m
}

/** Spread an amount over the oldest unpaid documents first. */
export function allocateFIFO(docs: { id: ID; date: string; total: number }[], paid: Record<ID, number>, amount: number) {
  const out: { docId: ID; amount: number }[] = []
  let left = amount
  for (const d of [...docs].sort((a, b) => a.date.localeCompare(b.date))) {
    if (left <= 0.005) break
    const due = round2(d.total - (paid[d.id] ?? 0))
    if (due <= 0.005) continue
    const a = round2(Math.min(due, left))
    out.push({ docId: d.id, amount: a })
    left = round2(left - a)
  }
  return out
}

export function docStatus(total: number, paid: number, cancelled: boolean): DocStatus {
  if (cancelled) return "cancelled"
  if (paid >= total - 0.5) return "paid"
  if (paid > 0) return "partial"
  return "due"
}

export interface PartySummary {
  sales: number
  purchase: number
  received: number
  paid: number
  /** Positive = receivable, negative = payable */
  balance: number
  lastTxn: string | null
}

export function partySummaries(s: Pick<DataState, "parties" | "invoices" | "purchases" | "payments">) {
  const m: Record<ID, PartySummary> = {}
  for (const p of s.parties) m[p.id] = { sales: 0, purchase: 0, received: 0, paid: 0, balance: p.openingBalance, lastTxn: null }
  const touch = (id: ID, date: string) => {
    if (!m[id].lastTxn || date > m[id].lastTxn!) m[id].lastTxn = date
  }
  for (const i of s.invoices) {
    if (!i.partyId || i.cancelled || !m[i.partyId]) continue
    m[i.partyId].sales += i.total
    m[i.partyId].balance += i.total
    touch(i.partyId, i.date)
  }
  for (const p of s.purchases) {
    if (p.cancelled || !m[p.partyId]) continue
    m[p.partyId].purchase += p.total
    m[p.partyId].balance -= p.total
    touch(p.partyId, p.date)
  }
  for (const pay of s.payments) {
    if (!pay.partyId || !m[pay.partyId]) continue
    if (pay.direction === "in") {
      m[pay.partyId].received += pay.amount
      m[pay.partyId].balance -= pay.amount
    } else {
      m[pay.partyId].paid += pay.amount
      m[pay.partyId].balance += pay.amount
    }
    touch(pay.partyId, pay.date)
  }
  for (const k in m) {
    m[k].balance = round2(m[k].balance)
    m[k].sales = round2(m[k].sales)
    m[k].purchase = round2(m[k].purchase)
  }
  return m
}

export interface LedgerRow {
  date: string
  ref: string
  href?: string
  type: string
  debit: number
  credit: number
  balance: number
  note?: string
}

/** Party ledger. Debit increases what the party owes us. */
export function partyLedger(
  party: Party,
  s: Pick<DataState, "invoices" | "purchases" | "payments">,
  from?: string,
  to?: string,
): { rows: LedgerRow[]; opening: number; closing: number } {
  type Entry = Omit<LedgerRow, "balance"> & { order: number }
  const entries: Entry[] = []
  s.invoices
    .filter((i) => i.partyId === party.id && !i.cancelled)
    .forEach((i) => entries.push({ date: i.date, ref: i.number, href: `/invoices/${i.id}`, type: "Sale", debit: i.total, credit: 0, order: 1 }))
  s.purchases
    .filter((p) => p.partyId === party.id && !p.cancelled)
    .forEach((p) => entries.push({ date: p.date, ref: p.number, href: `/purchases/${p.id}`, type: "Purchase", debit: 0, credit: p.total, order: 1 }))
  s.payments
    .filter((p) => p.partyId === party.id)
    .forEach((p) =>
      entries.push({
        date: p.date, ref: p.number, type: p.direction === "in" ? "Payment Received" : "Payment Given",
        debit: p.direction === "out" ? p.amount : 0, credit: p.direction === "in" ? p.amount : 0,
        note: p.reference, order: 2,
      }),
    )
  entries.sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order)
  let bal = party.openingBalance
  const rows: LedgerRow[] = []
  let opening = party.openingBalance
  for (const e of entries) {
    bal = round2(bal + e.debit - e.credit)
    if (from && e.date < from) {
      opening = bal
      continue
    }
    if (to && e.date > to) continue
    rows.push({ date: e.date, ref: e.ref, href: e.href, type: e.type, debit: e.debit, credit: e.credit, balance: bal, note: e.note })
  }
  const closing = rows.length ? rows[rows.length - 1].balance : opening
  return { rows, opening, closing }
}

export function stockValue(products: Product[], stock: Record<ID, number>) {
  return round2(products.reduce((s, p) => s + Math.max(0, stock[p.id] ?? 0) * p.purchasePrice, 0))
}

export const MOVE_LABEL: Record<StockMovement["type"], string> = {
  opening: "Opening Stock",
  purchase: "Purchase",
  sale: "Sale",
  sale_return: "Sale Cancelled",
  production_in: "Production Output",
  production_out: "Used in Production",
  adjustment_in: "Adjustment (+)",
  adjustment_out: "Adjustment (−)",
  manual_in: "Stock In",
  manual_out: "Stock Out",
}

export function sumBy<T>(arr: T[], f: (x: T) => number) {
  return round2(arr.reduce((s, x) => s + f(x), 0))
}

export function activeInvoices(invoices: Invoice[]) {
  return invoices.filter((i) => !i.cancelled)
}
export function activePurchases(purchases: Purchase[]) {
  return purchases.filter((p) => !p.cancelled)
}

/** Payments applied to one invoice / purchase, with the amount applied to it. */
export function paymentsForDoc(payments: Payment[], docId: ID) {
  return payments
    .map((p) => {
      if (p.invoiceId === docId || p.purchaseId === docId) return { ...p, applied: p.amount }
      const a = p.allocations?.find((x) => x.docId === docId)
      return a ? { ...p, applied: a.amount } : null
    })
    .filter((p): p is Payment & { applied: number } => !!p)
}
