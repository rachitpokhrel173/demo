"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus, RefreshCw, Trash2 } from "lucide-react"
import { useStore } from "@/lib/store"
import { useUI, type DialogState } from "@/lib/ui-store"
import { useInvoicePaid, usePartySummaries, useProductMap, usePurchasePaid, useStockMap } from "@/lib/hooks"
import { methodLabel, npr, qty as fmtQty, round2, todayISO } from "@/lib/format"
import type { BomItem, ExpenseCategory, PartyType, PaymentMethod, ProductKind, Unit } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { FormDialog } from "@/components/shared/form-dialog"
import { Field, Money } from "@/components/shared/ui-bits"
import { Segmented, SimpleSelect } from "@/components/shared/filters"
import { PartyPicker, ProductPicker } from "@/components/shared/pickers"

type Of<K> = Extract<NonNullable<DialogState>, { kind: K }>

export function GlobalDialogs() {
  const dialog = useUI((s) => s.dialog)
  const close = useUI((s) => s.closeDialog)
  // A fresh key per open resets each form's local state
  const [openCount, setOpenCount] = useState(0)
  const [last, setLast] = useState<DialogState>(null)
  if (dialog !== last) {
    setLast(dialog)
    if (dialog) setOpenCount((c) => c + 1)
  }
  if (!dialog) return null
  const k = openCount
  switch (dialog.kind) {
    case "party":
      return <PartyDialog key={k} onClose={close} d={dialog} />
    case "product":
      return <ProductDialog key={k} onClose={close} d={dialog} />
    case "payment":
      return <PaymentDialog key={k} onClose={close} d={dialog} />
    case "stock":
      return <StockDialog key={k} onClose={close} d={dialog} />
    case "expense":
      return <ExpenseDialog key={k} onClose={close} d={dialog} />
    case "bom":
      return <BomDialog key={k} onClose={close} d={dialog} />
  }
}

const num = (v: string) => (v === "" ? 0 : Number(v))

// ------------------------------------------------------------------ Party
function PartyDialog({ d, onClose }: { d: Of<"party">; onClose: () => void }) {
  const router = useRouter()
  const addParty = useStore((s) => s.addParty)
  const updateParty = useStore((s) => s.updateParty)
  const p = d.party
  const [f, setF] = useState({
    name: p?.name ?? "",
    type: (p?.type ?? d.defaultType ?? "customer") as PartyType,
    phone: p?.phone ?? "",
    email: p?.email ?? "",
    address: p?.address ?? "",
    pan: p?.pan ?? "",
    opening: p ? String(Math.abs(p.openingBalance)) : "",
    openingDir: (p && p.openingBalance < 0 ? "pay" : "receive") as "pay" | "receive",
    creditLimit: p ? String(p.creditLimit) : "",
    status: p?.status ?? "active",
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }))

  const submit = () => {
    const e: Record<string, string> = {}
    if (!f.name.trim()) e.name = "Party name is required"
    if (!/^[0-9\-, ]{7,}$/.test(f.phone.trim())) e.phone = "Enter a valid phone number"
    if (f.pan && !/^\d{9}$/.test(f.pan)) e.pan = "PAN/VAT must be 9 digits"
    setErrors(e)
    if (Object.keys(e).length) return
    const data = {
      name: f.name.trim(), type: f.type, phone: f.phone.trim(), email: f.email.trim(), address: f.address.trim(), pan: f.pan,
      openingBalance: num(f.opening) * (f.openingDir === "pay" ? -1 : 1), creditLimit: num(f.creditLimit),
      status: f.status as "active" | "inactive",
    }
    if (p) {
      updateParty(p.id, data)
      toast.success("Party updated", { description: data.name })
    } else {
      const id = addParty(data)
      toast.success("Party added", { description: data.name, action: { label: "Open profile", onClick: () => router.push(`/parties/${id}`) } })
    }
    onClose()
  }

  return (
    <FormDialog open onOpenChange={(o) => !o && onClose()} title={p ? "Edit Party" : "Add New Party"} description="Customers, suppliers or both — each party keeps its own ledger." onSubmit={submit} size="lg" submitText={p ? "Save Changes" : "Add Party"}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Party Name" required error={errors.name} className="sm:col-span-2">
          <Input autoFocus value={f.name} onChange={(e) => set("name")(e.target.value)} placeholder="e.g. Everest Hardware Store" />
        </Field>
        <Field label="Party Type" className="sm:col-span-2">
          <Segmented value={f.type} onChange={(v) => set("type")(v)} options={[{ value: "customer", label: "Customer" }, { value: "supplier", label: "Supplier" }, { value: "both", label: "Customer + Supplier" }]} />
        </Field>
        <Field label="Phone" required error={errors.phone}>
          <Input value={f.phone} onChange={(e) => set("phone")(e.target.value)} placeholder="98XXXXXXXX" inputMode="tel" />
        </Field>
        <Field label="Email">
          <Input type="email" value={f.email} onChange={(e) => set("email")(e.target.value)} placeholder="name@example.com" />
        </Field>
        <Field label="Address" className="sm:col-span-2">
          <Input value={f.address} onChange={(e) => set("address")(e.target.value)} placeholder="Street, City" />
        </Field>
        <Field label="PAN / VAT No." error={errors.pan}>
          <Input value={f.pan} onChange={(e) => set("pan")(e.target.value.replace(/\D/g, "").slice(0, 9))} placeholder="9 digits" inputMode="numeric" />
        </Field>
        <Field label="Credit Limit (NPR)" hint="Warns when balance goes over this">
          <Input type="number" min={0} value={f.creditLimit} onChange={(e) => set("creditLimit")(e.target.value)} placeholder="0" />
        </Field>
        <Field label="Opening Balance (NPR)" hint="Balance carried from your old books / Kaabar app">
          <Input type="number" min={0} value={f.opening} onChange={(e) => set("opening")(e.target.value)} placeholder="0" />
        </Field>
        <Field label="Opening Balance Type">
          <Segmented value={f.openingDir} onChange={(v) => set("openingDir")(v)} options={[{ value: "receive", label: "To Receive" }, { value: "pay", label: "To Pay" }]} />
        </Field>
        {p && (
          <Field label="Status">
            <Segmented value={f.status} onChange={(v) => set("status")(v)} options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />
          </Field>
        )}
      </div>
    </FormDialog>
  )
}

// ------------------------------------------------------------------ Product
function ProductDialog({ d, onClose }: { d: Of<"product">; onClose: () => void }) {
  const router = useRouter()
  const addProduct = useStore((s) => s.addProduct)
  const updateProduct = useStore((s) => s.updateProduct)
  const categories = useStore((s) => s.categories)
  const units = useStore((s) => s.units)
  const p = d.product
  const genBarcode = () => "890" + String(Math.floor(1e9 + Math.random() * 9e9))
  const [f, setF] = useState(() => ({
    name: p?.name ?? "",
    sku: p?.sku ?? `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
    barcode: p?.barcode ?? genBarcode(),
    category: p?.category ?? categories[0] ?? "",
    unit: (p?.unit ?? "PCS") as string,
    kind: (p?.kind ?? "trading") as ProductKind,
    purchasePrice: p ? String(p.purchasePrice) : "",
    sellingPrice: p ? String(p.sellingPrice) : "",
    openingStock: p ? String(p.openingStock) : "",
    minStock: p ? String(p.minStock) : "",
    vatRate: String(p?.vatRate ?? 13),
    status: p?.status ?? "active",
  }))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }))
  const margin = num(f.sellingPrice) - num(f.purchasePrice)

  const submit = () => {
    const e: Record<string, string> = {}
    if (!f.name.trim()) e.name = "Product name is required"
    if (!f.sku.trim()) e.sku = "SKU is required"
    if (f.purchasePrice === "") e.purchasePrice = "Required"
    if (f.sellingPrice === "" && f.kind !== "raw") e.sellingPrice = "Required"
    setErrors(e)
    if (Object.keys(e).length) return
    const data = {
      name: f.name.trim(), sku: f.sku.trim(), barcode: f.barcode, category: f.category, unit: f.unit as Unit, kind: f.kind,
      purchasePrice: num(f.purchasePrice), sellingPrice: num(f.sellingPrice), openingStock: num(f.openingStock),
      minStock: num(f.minStock), vatRate: num(f.vatRate), status: f.status as "active" | "inactive",
    }
    if (p) {
      const { openingStock: _o, ...rest } = data
      void _o
      updateProduct(p.id, rest)
      toast.success("Product updated", { description: data.name })
    } else {
      const id = addProduct(data)
      toast.success("Product added", { description: `${data.name} — opening stock ${data.openingStock} ${data.unit}`, action: { label: "View", onClick: () => router.push(`/products/${id}`) } })
    }
    onClose()
  }

  return (
    <FormDialog open onOpenChange={(o) => !o && onClose()} title={p ? "Edit Product" : "Add New Product"} onSubmit={submit} size="lg" submitText={p ? "Save Changes" : "Add Product"}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Product Name" required error={errors.name} className="sm:col-span-3">
          <Input autoFocus value={f.name} onChange={(e) => set("name")(e.target.value)} placeholder="e.g. Cement OPC 50kg" />
        </Field>
        <Field label="Product Type" className="sm:col-span-3">
          <Segmented value={f.kind} onChange={(v) => set("kind")(v)} options={[{ value: "trading", label: "Trading Item" }, { value: "raw", label: "Raw Material" }, { value: "finished", label: "Finished Good" }]} />
        </Field>
        <Field label="SKU / Code" required error={errors.sku}>
          <Input value={f.sku} onChange={(e) => set("sku")(e.target.value)} />
        </Field>
        <Field label="Barcode">
          <div className="flex gap-1">
            <Input value={f.barcode} onChange={(e) => set("barcode")(e.target.value)} />
            <Button type="button" variant="outline" size="icon" className="size-9" onClick={() => set("barcode")(genBarcode())} aria-label="Generate barcode">
              <RefreshCw />
            </Button>
          </div>
        </Field>
        <Field label="Category">
          <SimpleSelect value={f.category} onChange={set("category")} options={categories.map((c) => ({ value: c, label: c }))} />
        </Field>
        <Field label="Unit">
          <SimpleSelect value={f.unit} onChange={set("unit")} options={units.map((u) => ({ value: u, label: u }))} />
        </Field>
        <Field label="Purchase Price (NPR)" required error={errors.purchasePrice}>
          <Input type="number" min={0} step="any" value={f.purchasePrice} onChange={(e) => set("purchasePrice")(e.target.value)} />
        </Field>
        <Field label="Selling Price (NPR)" required={f.kind !== "raw"} error={errors.sellingPrice} hint={f.sellingPrice && f.purchasePrice ? `Margin: ${npr(margin)} (${f.purchasePrice !== "0" ? Math.round((margin / num(f.purchasePrice)) * 100) : 0}%)` : undefined}>
          <Input type="number" min={0} step="any" value={f.sellingPrice} onChange={(e) => set("sellingPrice")(e.target.value)} />
        </Field>
        {!p && (
          <Field label="Opening Stock">
            <Input type="number" min={0} step="any" value={f.openingStock} onChange={(e) => set("openingStock")(e.target.value)} placeholder="0" />
          </Field>
        )}
        <Field label="Minimum Stock" hint="Low-stock alert level">
          <Input type="number" min={0} step="any" value={f.minStock} onChange={(e) => set("minStock")(e.target.value)} placeholder="0" />
        </Field>
        <Field label="VAT">
          <SimpleSelect value={f.vatRate} onChange={set("vatRate")} options={[{ value: "13", label: "VAT 13%" }, { value: "0", label: "VAT Exempt (0%)" }]} />
        </Field>
        {p && (
          <Field label="Status">
            <SimpleSelect value={f.status} onChange={set("status")} options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />
          </Field>
        )}
      </div>
    </FormDialog>
  )
}

// ------------------------------------------------------------------ Payment
function PaymentDialog({ d, onClose }: { d: Of<"payment">; onClose: () => void }) {
  const recordPayment = useStore((s) => s.recordPayment)
  const methods = useStore((s) => s.paymentMethods)
  const invoices = useStore((s) => s.invoices)
  const purchases = useStore((s) => s.purchases)
  const parties = useStore((s) => s.parties)
  const summaries = usePartySummaries()
  const invPaid = useInvoicePaid()
  const purPaid = usePurchasePaid()
  const invoice = d.invoiceId ? invoices.find((i) => i.id === d.invoiceId) : undefined
  const purchase = d.purchaseId ? purchases.find((i) => i.id === d.purchaseId) : undefined
  const docDue = invoice ? round2(invoice.total - (invPaid[invoice.id] ?? 0)) : purchase ? round2(purchase.total - (purPaid[purchase.id] ?? 0)) : undefined

  const [direction, setDirection] = useState<"in" | "out">(d.direction)
  const [partyId, setPartyId] = useState<string | null>(d.partyId ?? invoice?.partyId ?? purchase?.partyId ?? null)
  const [f, setF] = useState({
    date: todayISO(),
    amount: d.amount ? String(d.amount) : docDue ? String(docDue) : "",
    method: "cash" as PaymentMethod,
    reference: "",
    notes: invoice ? `Against ${invoice.number}` : purchase ? `Against ${purchase.number}` : "",
  })
  const [error, setError] = useState("")
  const balance = partyId ? summaries[partyId]?.balance ?? 0 : 0
  const party = parties.find((p) => p.id === partyId)
  const locked = !!(invoice || purchase)

  const submit = () => {
    const amt = num(f.amount)
    if (!partyId && !invoice) return setError("Select a party")
    if (!(amt > 0)) return setError("Enter an amount greater than zero")
    if (docDue !== undefined && amt > docDue + 0.5) return setError(`Amount cannot exceed the due of ${npr(docDue)}`)
    recordPayment({
      date: f.date, partyId, direction, amount: amt, method: f.method, reference: f.reference || undefined, notes: f.notes || undefined,
      invoiceId: invoice?.id, purchaseId: purchase?.id,
    })
    const after = round2(balance + (direction === "in" ? -amt : amt))
    toast.success(direction === "in" ? "Payment received" : "Payment recorded", {
      description: `${npr(amt)} via ${methodLabel(f.method)}${party ? ` · ${party.name} balance now ${npr(Math.abs(after))} ${after > 0.5 ? "to receive" : after < -0.5 ? "to pay" : ""}` : ""}`,
    })
    onClose()
  }

  return (
    <FormDialog open onOpenChange={(o) => !o && onClose()} title={direction === "in" ? "Receive Payment" : "Give Payment"} description={direction === "in" ? "Money received from a customer" : "Money paid to a supplier"} onSubmit={submit} submitText={direction === "in" ? "Save Receipt" : "Save Payment"}>
      <div className="grid gap-4 sm:grid-cols-2">
        {!locked && (
          <Field label="Type" className="sm:col-span-2">
            <Segmented value={direction} onChange={(v) => { setDirection(v); setPartyId(null) }} options={[{ value: "in", label: "Money Received" }, { value: "out", label: "Money Paid" }]} />
          </Field>
        )}
        {locked ? (
          <div className="rounded-md border bg-muted/40 p-3 text-sm sm:col-span-2">
            <div className="flex justify-between"><span className="text-muted-foreground">{invoice ? "Invoice" : "Purchase"}</span><b>{invoice?.number ?? purchase?.number}</b></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Party</span><span>{invoice?.customerName ?? party?.name}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="num">{npr((invoice ?? purchase)!.total)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Due</span><Money value={docDue ?? 0} kind="due" /></div>
          </div>
        ) : (
          <Field label="Party" required className="sm:col-span-2" hint={partyId ? <>Current balance: <Money value={balance} kind="balance" /></> : undefined}>
            <PartyPicker value={partyId} onChange={setPartyId} role={direction === "in" ? "customer" : "supplier"} />
          </Field>
        )}
        <Field label="Amount (NPR)" required>
          <Input autoFocus type="number" min={0} step="any" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="0" />
          {!locked && partyId && Math.abs(balance) > 0.5 && (
            <button type="button" className="self-start text-xs text-primary hover:underline" onClick={() => setF({ ...f, amount: String(Math.abs(balance)) })}>
              Fill full balance ({npr(Math.abs(balance))})
            </button>
          )}
        </Field>
        <Field label="Date" required>
          <Input type="date" value={f.date} max={todayISO()} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </Field>
        <Field label="Payment Method">
          <SimpleSelect value={f.method} onChange={(v) => setF({ ...f, method: v as PaymentMethod })} options={methods.filter((m) => m.enabled && m.value !== "credit").map((m) => ({ value: m.value, label: m.label }))} />
        </Field>
        <Field label="Reference" hint="Cheque no., transaction ID…">
          <Input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
        {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
      </div>
    </FormDialog>
  )
}

// ------------------------------------------------------------------ Stock in / out / adjustment
const ADJ_REASONS = ["Physical count difference", "Damaged", "Lost / Theft", "Expired", "Sample / Gift", "Other"]

function StockDialog({ d, onClose }: { d: Of<"stock">; onClose: () => void }) {
  const stockEntry = useStore((s) => s.stockEntry)
  const stock = useStockMap()
  const products = useProductMap()
  const [mode, setMode] = useState(d.mode)
  const [productId, setProductId] = useState<string | null>(d.productId ?? null)
  const [f, setF] = useState({ date: todayISO(), qty: "", counted: "", reason: ADJ_REASONS[0], note: "" })
  const [error, setError] = useState("")
  const p = productId ? products[productId] : undefined
  const current = productId ? stock[productId] ?? 0 : 0
  const diff = mode === "adjust" && f.counted !== "" ? round2(num(f.counted) - current) : 0

  const submit = () => {
    if (!productId) return setError("Select a product")
    let type: "manual_in" | "manual_out" | "adjustment_in" | "adjustment_out"
    let q: number
    if (mode === "adjust") {
      if (f.counted === "") return setError("Enter the physically counted quantity")
      if (diff === 0) return setError("Counted stock equals system stock — nothing to adjust")
      type = diff > 0 ? "adjustment_in" : "adjustment_out"
      q = Math.abs(diff)
    } else {
      q = num(f.qty)
      if (!(q > 0)) return setError("Enter a quantity greater than zero")
      type = mode === "in" ? "manual_in" : "manual_out"
    }
    const r = stockEntry({ date: f.date, productId, type, qty: q, note: [mode === "adjust" ? f.reason : "", f.note].filter(Boolean).join(" — ") })
    if (!r.ok) return setError(r.error)
    toast.success(mode === "adjust" ? "Stock adjusted" : mode === "in" ? "Stock added" : "Stock removed", {
      description: `${p?.name}: ${fmtQty(current)} → ${fmtQty(round2(current + (type.endsWith("_in") ? q : -q)))} ${p?.unit}`,
    })
    onClose()
  }

  return (
    <FormDialog open onOpenChange={(o) => !o && onClose()} title="Stock Entry" description="Manual stock in, stock out or adjustment after physical count." onSubmit={submit} submitText="Save Entry">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Entry Type" className="sm:col-span-2">
          <Segmented value={mode} onChange={setMode} options={[{ value: "in", label: "Stock In" }, { value: "out", label: "Stock Out" }, { value: "adjust", label: "Adjustment" }]} />
        </Field>
        <Field label="Product" required className="sm:col-span-2" hint={p ? <>Current stock: <b className="text-foreground">{fmtQty(current)} {p.unit}</b></> : undefined}>
          <ProductPicker value={productId} onChange={setProductId} />
        </Field>
        {mode === "adjust" ? (
          <>
            <Field label={`Physical Count${p ? ` (${p.unit})` : ""}`} required hint={f.counted !== "" ? <span className={diff > 0 ? "text-success" : diff < 0 ? "text-destructive" : ""}>Difference: {diff > 0 ? "+" : ""}{fmtQty(diff)} {p?.unit}</span> : "Enter what you actually counted"}>
              <Input type="number" min={0} step="any" value={f.counted} onChange={(e) => setF({ ...f, counted: e.target.value })} />
            </Field>
            <Field label="Reason">
              <SimpleSelect value={f.reason} onChange={(v) => setF({ ...f, reason: v })} options={ADJ_REASONS.map((r) => ({ value: r, label: r }))} />
            </Field>
          </>
        ) : (
          <Field label={`Quantity${p ? ` (${p.unit})` : ""}`} required>
            <Input type="number" min={0} step="any" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} />
          </Field>
        )}
        <Field label="Date">
          <Input type="date" value={f.date} max={todayISO()} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </Field>
        <Field label="Note" className="sm:col-span-2">
          <Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Optional remark" />
        </Field>
        {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
      </div>
    </FormDialog>
  )
}

// ------------------------------------------------------------------ Expense
export const EXPENSE_CATEGORIES: ExpenseCategory[] = ["Rent", "Salary", "Electricity", "Transport", "Office", "Marketing", "Maintenance", "Other"]

function ExpenseDialog({ d, onClose }: { d: Of<"expense">; onClose: () => void }) {
  const addExpense = useStore((s) => s.addExpense)
  const updateExpense = useStore((s) => s.updateExpense)
  const methods = useStore((s) => s.paymentMethods)
  const x = d.expense
  const [f, setF] = useState({
    date: x?.date ?? todayISO(),
    category: (x?.category ?? "Transport") as ExpenseCategory,
    amount: x ? String(x.amount) : "",
    method: (x?.method ?? "cash") as PaymentMethod,
    description: x?.description ?? "",
    paidTo: x?.paidTo ?? "",
  })
  const [error, setError] = useState("")
  const submit = () => {
    if (!(num(f.amount) > 0)) return setError("Enter an amount greater than zero")
    if (!f.description.trim()) return setError("Add a short description")
    const data = { ...f, amount: num(f.amount), description: f.description.trim(), paidTo: f.paidTo || undefined }
    if (x) updateExpense(x.id, data)
    else addExpense(data)
    toast.success(x ? "Expense updated" : "Expense added", { description: `${f.category} · ${npr(data.amount)}` })
    onClose()
  }
  return (
    <FormDialog open onOpenChange={(o) => !o && onClose()} title={x ? "Edit Expense" : "Add Expense"} onSubmit={submit} submitText={x ? "Save Changes" : "Add Expense"}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category" required>
          <SimpleSelect value={f.category} onChange={(v) => setF({ ...f, category: v as ExpenseCategory })} options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))} />
        </Field>
        <Field label="Amount (NPR)" required>
          <Input autoFocus type="number" min={0} step="any" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        </Field>
        <Field label="Expense Date" required>
          <Input type="date" value={f.date} max={todayISO()} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </Field>
        <Field label="Payment Method">
          <SimpleSelect value={f.method} onChange={(v) => setF({ ...f, method: v as PaymentMethod })} options={methods.filter((m) => m.enabled && m.value !== "credit").map((m) => ({ value: m.value, label: m.label }))} />
        </Field>
        <Field label="Paid To" className="sm:col-span-2">
          <Input value={f.paidTo} onChange={(e) => setF({ ...f, paidTo: e.target.value })} placeholder="Optional" />
        </Field>
        <Field label="Description" required className="sm:col-span-2">
          <Textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="e.g. Delivery vehicle fuel" />
        </Field>
        {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
      </div>
    </FormDialog>
  )
}

// ------------------------------------------------------------------ Bill of Materials
function BomDialog({ d, onClose }: { d: Of<"bom">; onClose: () => void }) {
  const saveBom = useStore((s) => s.saveBom)
  const products = useProductMap()
  const b = d.bom
  const [productId, setProductId] = useState<string | null>(b?.productId ?? null)
  const [name, setName] = useState(b?.name ?? "")
  const [outputQty, setOutputQty] = useState(String(b?.outputQty ?? 1))
  const [overhead, setOverhead] = useState(String(b?.overheadCost ?? 0))
  const [notes, setNotes] = useState(b?.notes ?? "")
  const [items, setItems] = useState<(BomItem & { key: number })[]>(
    (b?.items ?? [{ productId: "", qty: 1 }]).map((it, i) => ({ ...it, key: i })),
  )
  const [error, setError] = useState("")
  const matCost = useMemo(() => items.reduce((s, it) => s + (products[it.productId]?.purchasePrice ?? 0) * it.qty, 0), [items, products])
  const total = matCost + num(overhead)
  const perUnit = num(outputQty) > 0 ? total / num(outputQty) : 0
  const finished = productId ? products[productId] : undefined

  const submit = () => {
    if (!productId) return setError("Select the finished product")
    const valid = items.filter((i) => i.productId && i.qty > 0)
    if (!valid.length) return setError("Add at least one raw material")
    if (valid.some((i) => i.productId === productId)) return setError("A product cannot be a material of itself")
    saveBom({ id: b?.id, productId, name: name.trim() || `${products[productId].name} — Standard`, outputQty: num(outputQty) || 1, overheadCost: num(overhead), notes, items: valid.map(({ productId, qty }) => ({ productId, qty })) })
    toast.success(b ? "BOM updated" : "BOM created", { description: `Estimated cost ${npr(perUnit)} per ${finished?.unit}` })
    onClose()
  }

  return (
    <FormDialog open onOpenChange={(o) => !o && onClose()} title={b ? "Edit Bill of Materials" : "New Bill of Materials"} description="Define the raw materials needed to make a finished product." onSubmit={submit} size="xl" submitText="Save BOM">
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Finished Product" required className="sm:col-span-2">
          <ProductPicker value={productId} onChange={setProductId} filter={(p) => p.kind === "finished"} placeholder="Select finished product" />
        </Field>
        <Field label="BOM Name" className="sm:col-span-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Standard Mix" />
        </Field>
        <Field label={`Output Quantity${finished ? ` (${finished.unit})` : ""}`} hint="Units produced by one batch of the materials below">
          <Input type="number" min={0} step="any" value={outputQty} onChange={(e) => setOutputQty(e.target.value)} />
        </Field>
        <Field label="Labour & Overhead per Batch (NPR)">
          <Input type="number" min={0} step="any" value={overhead} onChange={(e) => setOverhead(e.target.value)} />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Process notes (optional)" />
        </Field>
      </div>

      <div className="mt-5 overflow-x-auto rounded-md border">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Raw Material</th>
              <th className="w-32 px-3 py-2 text-right font-semibold">Qty</th>
              <th className="w-20 px-3 py-2 text-left font-semibold">Unit</th>
              <th className="w-28 px-3 py-2 text-right font-semibold">Rate</th>
              <th className="w-32 px-3 py-2 text-right font-semibold">Amount</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => {
              const rp = products[it.productId]
              return (
                <tr key={it.key} className="border-t">
                  <td className="px-2 py-1.5">
                    <ProductPicker value={it.productId || null} onChange={(v) => setItems(items.map((x, i) => (i === idx ? { ...x, productId: v } : x)))} filter={(p) => p.kind === "raw"} placeholder="Select raw material" />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input type="number" min={0} step="any" className="h-9 text-right" value={it.qty} onChange={(e) => setItems(items.map((x, i) => (i === idx ? { ...x, qty: num(e.target.value) } : x)))} />
                  </td>
                  <td className="px-3 py-1.5 text-muted-foreground">{rp?.unit ?? "—"}</td>
                  <td className="num px-3 py-1.5 text-right">{rp ? npr(rp.purchasePrice) : "—"}</td>
                  <td className="num px-3 py-1.5 text-right font-medium">{rp ? npr(rp.purchasePrice * it.qty) : "—"}</td>
                  <td className="px-1">
                    <Button type="button" variant="ghost" size="icon-sm" disabled={items.length === 1} onClick={() => setItems(items.filter((_, i) => i !== idx))} aria-label="Remove material">
                      <Trash2 />
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="border-t p-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setItems([...items, { productId: "", qty: 1, key: Date.now() }])}>
            <Plus /> Add material
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-2 rounded-md bg-muted/50 p-3 text-sm sm:ml-auto sm:w-80">
        <div className="flex justify-between"><span className="text-muted-foreground">Material cost</span><span className="num">{npr(matCost)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Labour & overhead</span><span className="num">{npr(num(overhead))}</span></div>
        <div className="flex justify-between border-t pt-2 font-semibold"><span>Estimated cost / batch</span><span className="num">{npr(total)}</span></div>
        <div className="flex justify-between font-semibold text-primary"><span>Cost per {finished?.unit ?? "unit"}</span><span className="num">{npr(perUnit)}</span></div>
        {finished && finished.sellingPrice > 0 && (
          <div className="flex justify-between text-xs text-muted-foreground"><span>Selling price {npr(finished.sellingPrice)}</span><span>Margin {Math.round(((finished.sellingPrice - perUnit) / finished.sellingPrice) * 100)}%</span></div>
        )}
      </div>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </FormDialog>
  )
}
