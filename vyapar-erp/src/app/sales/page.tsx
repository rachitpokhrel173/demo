"use client"

import { Suspense, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Banknote, Building2, CreditCard, FileText, Minus, PackageSearch, Plus, Printer, Save, ScanBarcode, Smartphone, Trash2, Wallet, X } from "lucide-react"
import { computeTotals, npr, qty as fmtQty, round2, todayISO } from "@/lib/format"
import { usePartySummaries, useProductMap, useStockMap } from "@/lib/hooks"
import { useStore } from "@/lib/store"
import type { ID, LineItem, PaymentMethod } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { PageHeader, Money } from "@/components/shared/ui-bits"
import { PartyPicker } from "@/components/shared/pickers"
import { StatusBadge } from "@/components/shared/status-badge"

const METHODS: { value: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "bank", label: "Bank", icon: Building2 },
  { value: "esewa", label: "eSewa", icon: Smartphone },
  { value: "khalti", label: "Khalti", icon: Wallet },
  { value: "credit", label: "Credit / Due", icon: CreditCard },
]

export default function SalesPage() {
  return (
    <Suspense>
      <PosScreen />
    </Suspense>
  )
}

function PosScreen() {
  const router = useRouter()
  const params = useSearchParams()
  const products = useStore((s) => s.products)
  const categories = useStore((s) => s.categories)
  const business = useStore((s) => s.business)
  const parties = useStore((s) => s.parties)
  const createSale = useStore((s) => s.createSale)
  const enabledMethods = useStore((s) => s.paymentMethods)
  const stock = useStockMap()
  const productMap = useProductMap()
  const summaries = usePartySummaries()

  const [partyId, setPartyId] = useState<ID | null>(params.get("party"))
  const [date, setDate] = useState(todayISO())
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("All")
  const [cart, setCart] = useState<LineItem[]>([])
  const [applyVat, setApplyVat] = useState(business.vatRegistered)
  const [discountMode, setDiscountMode] = useState<"amt" | "pct">("amt")
  const [discountInput, setDiscountInput] = useState("")
  const [method, setMethod] = useState<PaymentMethod>("cash")
  const [paidInput, setPaidInput] = useState<string | null>(null)
  const [notes, setNotes] = useState("")
  const searchRef = useRef<HTMLInputElement>(null)

  const party = parties.find((p) => p.id === partyId)
  const balance = partyId ? summaries[partyId]?.balance ?? 0 : 0

  const sellable = useMemo(
    () =>
      products.filter((p) => {
        if (p.status !== "active" || p.sellingPrice <= 0) return false
        if (category !== "All" && p.category !== category) return false
        const q = search.trim().toLowerCase()
        return !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode.includes(q)
      }),
    [products, category, search],
  )

  const items = useMemo(() => cart.map((it) => ({ ...it, vatRate: applyVat ? productMap[it.productId]?.vatRate ?? 13 : 0 })), [cart, applyVat, productMap])
  const pre = computeTotals(items)
  const billDiscount = discountMode === "pct" ? round2((pre.taxable * (Number(discountInput) || 0)) / 100) : Number(discountInput) || 0
  const t = computeTotals(items, billDiscount)
  const paid = method === "credit" ? Number(paidInput ?? 0) || 0 : paidInput === null ? t.total : Number(paidInput) || 0
  const due = round2(Math.max(0, t.total - paid))
  const change = round2(Math.max(0, paid - t.total))

  const add = (id: ID) => {
    const p = productMap[id]
    const inCart = cart.find((c) => c.productId === id)
    const available = stock[id] ?? 0
    if ((inCart?.qty ?? 0) + 1 > available) {
      toast.error(`Only ${fmtQty(available)} ${p.unit} of ${p.name} in stock`)
      return
    }
    setCart((c) =>
      inCart
        ? c.map((x) => (x.productId === id ? { ...x, qty: x.qty + 1 } : x))
        : [...c, { productId: id, name: p.name, unit: p.unit, qty: 1, rate: p.sellingPrice, discount: 0, vatRate: p.vatRate }],
    )
  }
  const update = (id: ID, patch: Partial<LineItem>) => setCart((c) => c.map((x) => (x.productId === id ? { ...x, ...patch } : x)))
  const remove = (id: ID) => setCart((c) => c.filter((x) => x.productId !== id))

  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return
    const exact = products.find((p) => p.barcode === search.trim() || p.sku.toLowerCase() === search.trim().toLowerCase())
    const target = exact ?? (sellable.length === 1 ? sellable[0] : undefined)
    if (target) {
      add(target.id)
      setSearch("")
    }
  }

  const reset = () => {
    setCart([])
    setDiscountInput("")
    setPaidInput(null)
    setNotes("")
    setMethod("cash")
  }

  const save = (print: boolean) => {
    if (!cart.length) return toast.error("Add at least one product to the bill")
    const over = items.find((it) => it.qty > (stock[it.productId] ?? 0))
    if (over) return toast.error(`Not enough stock for ${over.name}`)
    if (!partyId && due > 0) return toast.error("Walk-in sales must be fully paid. Select a customer to give credit.")
    if (party && party.creditLimit > 0 && balance + due > party.creditLimit) {
      toast.warning(`${party.name} will exceed credit limit of ${npr(party.creditLimit)}`)
    }
    const r = createSale({ date, partyId, items, billDiscount, paid: Math.min(paid, t.total), method, notes })
    if (!r.ok) return toast.error(r.error)
    toast.success("Invoice saved", { description: `${npr(t.total)} · ${due > 0 ? `Due ${npr(due)}` : "Fully paid"} · stock updated` })
    reset()
    router.push(`/invoices/${r.id}?created=1${print ? "&print=1" : ""}`)
  }

  return (
    <div>
      <PageHeader
        title="New Sale"
        description="Point of sale — select customer, add products and save the bill."
        actions={
          <Button variant="outline" className="h-9" render={<Link href="/invoices" />} nativeButton={false}>
            <FileText /> All Invoices
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        {/* LEFT: customer + products */}
        <div className="min-w-0 space-y-4">
          <div className="grid gap-3 rounded-lg border bg-card p-4 shadow-xs sm:grid-cols-[1fr_170px_150px]">
            <div className="min-w-0">
              <label className="mb-1.5 block text-xs font-medium text-foreground/80">Customer</label>
              <PartyPicker value={partyId} onChange={setPartyId} role="customer" allowWalkIn />
              {party && (
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{party.phone}</span>
                  <span>PAN {party.pan || "—"}</span>
                  <span>Balance: <Money value={balance} kind="balance" /></span>
                  {party.creditLimit > 0 && <span>Limit {npr(party.creditLimit)}</span>}
                </div>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground/80">Invoice Date</label>
              <Input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} className="h-9" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground/80">Invoice No.</label>
              <div className="flex h-9 items-center rounded-lg border bg-muted/50 px-2.5 text-sm font-medium">
                {business.invoicePrefix}
                {business.nextInvoiceNo}
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-card shadow-xs">
            <div className="flex flex-col gap-3 border-b p-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <ScanBarcode className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={searchRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={onSearchKey}
                  placeholder="Search product name / SKU or scan barcode, then press Enter"
                  className="h-9 pl-8"
                />
              </div>
            </div>
            <div className="flex gap-1.5 overflow-x-auto border-b px-3 py-2 [scrollbar-width:none]">
              {["All", ...categories].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={cn(
                    "h-7 shrink-0 rounded-full border px-3 text-xs font-medium whitespace-nowrap transition-colors",
                    category === c ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
            {sellable.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-sm text-muted-foreground">
                <PackageSearch className="mb-2 size-6" /> No products match your search.
              </div>
            ) : (
              <div className="grid max-h-[520px] grid-cols-1 gap-2 overflow-y-auto p-3 min-[480px]:grid-cols-2 lg:grid-cols-3">
                {sellable.map((p) => {
                  const q = stock[p.id] ?? 0
                  const inCart = cart.find((c) => c.productId === p.id)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={q <= 0}
                      onClick={() => add(p.id)}
                      className={cn(
                        "flex flex-col items-start rounded-md border p-3 text-left transition-colors hover:border-primary/50 hover:bg-primary/[0.03] disabled:cursor-not-allowed disabled:opacity-50",
                        inCart && "border-primary/60 bg-primary/[0.04] ring-1 ring-primary/30",
                      )}
                    >
                      <div className="line-clamp-2 min-h-10 text-sm font-medium">{p.name}</div>
                      <div className="mt-1 text-[11px] text-muted-foreground">{p.sku}</div>
                      <div className="mt-2 flex w-full items-end justify-between gap-2">
                        <div className="num text-sm font-semibold text-primary">
                          {npr(p.sellingPrice)}
                          <span className="text-[11px] font-normal text-muted-foreground">/{p.unit}</span>
                        </div>
                        {q <= 0 ? (
                          <StatusBadge status="out" />
                        ) : (
                          <span className={cn("text-[11px]", q <= p.minStock ? "font-medium text-warning" : "text-muted-foreground")}>
                            {fmtQty(q)} in stock
                          </span>
                        )}
                      </div>
                      {inCart && <div className="mt-1.5 text-[11px] font-medium text-primary">In bill × {fmtQty(inCart.qty)}</div>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: bill */}
        <div className="xl:sticky xl:top-[4.5rem] xl:self-start">
          <div className="flex flex-col rounded-lg border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <div className="text-sm font-semibold">Current Bill</div>
                <div className="text-xs text-muted-foreground">{party?.name ?? "Cash Sale (Walk-in)"}</div>
              </div>
              {cart.length > 0 && (
                <Button variant="ghost" size="sm" onClick={reset}>
                  <X /> Clear
                </Button>
              )}
            </div>

            <div className="max-h-[340px] min-h-32 overflow-y-auto">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 py-10 text-center text-sm text-muted-foreground">
                  <ScanBarcode className="mb-2 size-6" />
                  Click a product or scan a barcode to add it to the bill.
                </div>
              ) : (
                <ul className="divide-y">
                  {items.map((it) => {
                    const available = stock[it.productId] ?? 0
                    const lineTotal = it.qty * it.rate - it.discount
                    return (
                      <li key={it.productId} className="px-4 py-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 text-sm leading-snug font-medium">{it.name}</div>
                          <button type="button" onClick={() => remove(it.productId)} className="rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={`Remove ${it.name}`}>
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                        <div className="mt-2 grid grid-cols-[auto_1fr_1fr] items-end gap-2">
                          <div>
                            <div className="mb-1 text-[10px] text-muted-foreground uppercase">Qty ({it.unit})</div>
                            <div className="flex items-center">
                              <Button variant="outline" size="icon-sm" onClick={() => it.qty > 1 && update(it.productId, { qty: it.qty - 1 })} aria-label="Decrease">
                                <Minus />
                              </Button>
                              <Input
                                type="number"
                                min={0}
                                step="any"
                                value={it.qty}
                                onChange={(e) => update(it.productId, { qty: Math.min(Number(e.target.value) || 0, available) })}
                                className="mx-1 h-7 w-16 px-1 text-center"
                              />
                              <Button variant="outline" size="icon-sm" onClick={() => it.qty + 1 <= available ? update(it.productId, { qty: it.qty + 1 }) : toast.error(`Only ${fmtQty(available)} ${it.unit} in stock`)} aria-label="Increase">
                                <Plus />
                              </Button>
                            </div>
                          </div>
                          <div>
                            <div className="mb-1 text-[10px] text-muted-foreground uppercase">Rate</div>
                            <Input type="number" min={0} step="any" value={it.rate} onChange={(e) => update(it.productId, { rate: Number(e.target.value) || 0 })} className="h-7 px-1.5 text-right" />
                          </div>
                          <div>
                            <div className="mb-1 text-[10px] text-muted-foreground uppercase">Disc. (NPR)</div>
                            <Input type="number" min={0} step="any" value={it.discount || ""} placeholder="0" onChange={(e) => update(it.productId, { discount: Number(e.target.value) || 0 })} className="h-7 px-1.5 text-right" />
                          </div>
                        </div>
                        <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
                          <span>Stock after sale: {fmtQty(round2(available - it.qty))} {it.unit}</span>
                          <span className="num font-semibold text-foreground">{npr(lineTotal)}</span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <div className="space-y-2 border-t bg-muted/30 px-4 py-3 text-sm">
              <Row label="Subtotal" value={npr(t.subtotal)} />
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Bill Discount</span>
                <div className="flex items-center gap-1">
                  <div className="flex rounded-md border bg-card p-0.5 text-[11px]">
                    {(["amt", "pct"] as const).map((m) => (
                      <button key={m} type="button" onClick={() => setDiscountMode(m)} className={cn("rounded px-1.5 py-0.5", discountMode === m && "bg-primary text-primary-foreground")}>
                        {m === "amt" ? "NPR" : "%"}
                      </button>
                    ))}
                  </div>
                  <Input type="number" min={0} step="any" value={discountInput} onChange={(e) => setDiscountInput(e.target.value)} placeholder="0" className="h-7 w-24 bg-card text-right" />
                </div>
              </div>
              {t.discount > 0 && <Row label="Total Discount" value={`− ${npr(t.discount)}`} />}
              <Row label="Taxable Amount" value={npr(t.taxable)} />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-muted-foreground">
                  <Switch checked={applyVat} onCheckedChange={setApplyVat} size="sm" /> VAT 13%
                </label>
                <span className="num">{npr(t.tax)}</span>
              </div>
              <div className="flex items-center justify-between border-t pt-2 text-base font-semibold">
                <span>Grand Total</span>
                <span className="num text-primary">{npr(t.total)}</span>
              </div>
            </div>

            <div className="space-y-3 border-t px-4 py-3">
              <div>
                <div className="mb-1.5 text-xs font-medium text-foreground/80">Payment Method</div>
                <div className="grid grid-cols-5 gap-1.5">
                  {METHODS.filter((m) => enabledMethods.find((e) => e.value === m.value)?.enabled !== false).map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => {
                        setMethod(m.value)
                        setPaidInput(m.value === "credit" ? "0" : null)
                      }}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-md border px-1 py-2 text-[11px] font-medium transition-colors",
                        method === m.value ? "border-primary bg-primary/5 text-primary ring-1 ring-primary/40" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <m.icon className="size-4" />
                      <span className="leading-tight">{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="mb-1 text-xs font-medium text-foreground/80">{method === "credit" ? "Advance Paid" : "Amount Received"}</div>
                  <Input type="number" min={0} step="any" value={paidInput ?? String(t.total)} onChange={(e) => setPaidInput(e.target.value)} className="h-9 text-right font-medium" />
                </div>
                <div>
                  <div className="mb-1 text-xs font-medium text-foreground/80">{change > 0 ? "Return Change" : "Due Amount"}</div>
                  <div className={cn("num flex h-9 items-center justify-end rounded-lg border px-2.5 font-semibold", change > 0 ? "bg-success/10 text-success" : due > 0 ? "bg-destructive/5 text-destructive" : "bg-muted/50")}>
                    {npr(change > 0 ? change : due)}
                  </div>
                </div>
              </div>
              {due > 0 && !partyId && <p className="text-xs text-destructive">Select a customer to sell on credit.</p>}
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Remarks (optional) — e.g. delivery site, vehicle no." className="h-8 text-xs" />
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="h-10" onClick={() => save(false)}>
                  <Save /> Save
                </Button>
                <Button className="h-10" onClick={() => save(true)}>
                  <Printer /> Save & Print
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="num">{value}</span>
    </div>
  )
}
