"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Save } from "lucide-react"
import { computeTotals, npr, round2, todayISO } from "@/lib/format"
import { usePartySummaries, useProductMap } from "@/lib/hooks"
import { useStore } from "@/lib/store"
import type { PaymentMethod } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, Money, PageHeader, Panel } from "@/components/shared/ui-bits"
import { PartyPicker } from "@/components/shared/pickers"
import { SimpleSelect } from "@/components/shared/filters"
import { LineItemsEditor, blankLine, type EditableLine } from "@/components/shared/line-items-editor"

export default function NewPurchasePage() {
  return (
    <Suspense>
      <PurchaseForm />
    </Suspense>
  )
}

function PurchaseForm() {
  const router = useRouter()
  const params = useSearchParams()
  const createPurchase = useStore((s) => s.createPurchase)
  const business = useStore((s) => s.business)
  const methods = useStore((s) => s.paymentMethods)
  const products = useProductMap()
  const summaries = usePartySummaries()

  const [partyId, setPartyId] = useState<string | null>(params.get("party"))
  const [date, setDate] = useState(todayISO())
  const [billNo, setBillNo] = useState("")
  const [lines, setLines] = useState<EditableLine[]>(() => {
    const pid = params.get("product")
    const p = pid ? products[pid] : undefined
    return [p ? { ...blankLine(), productId: p.id, name: p.name, unit: p.unit, rate: p.purchasePrice, vatRate: p.vatRate, qty: Math.max(p.minStock * 2, 1) } : blankLine()]
  })
  const [billDiscount, setBillDiscount] = useState("")
  const [method, setMethod] = useState<PaymentMethod>("credit")
  const [paidInput, setPaidInput] = useState("0")
  const [notes, setNotes] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})

  const valid = lines.filter((l) => l.productId && l.qty > 0)
  const t = computeTotals(valid, Number(billDiscount) || 0)
  const paid = Math.min(Number(paidInput) || 0, t.total)
  const due = round2(t.total - paid)
  const balance = partyId ? summaries[partyId]?.balance ?? 0 : 0

  const save = () => {
    const e: Record<string, string> = {}
    if (!partyId) e.party = "Select a supplier"
    if (!valid.length) e.items = "Add at least one product with quantity"
    if (lines.some((l) => l.productId && l.qty > 0 && l.rate <= 0)) e.items = "Enter purchase rate for all items"
    setErrors(e)
    if (Object.keys(e).length) return toast.error(Object.values(e)[0])
    const r = createPurchase({ date, partyId: partyId!, supplierBillNo: billNo, items: valid.map((l) => ({ productId: l.productId, name: l.name, unit: l.unit, qty: l.qty, rate: l.rate, discount: l.discount, vatRate: l.vatRate })), billDiscount: Number(billDiscount) || 0, paid, method, notes })
    if (!r.ok) return toast.error(r.error)
    toast.success("Purchase saved — stock increased", {
      description: valid.map((l) => `+${l.qty} ${l.unit} ${l.name}`).join(", "),
    })
    router.push(`/purchases/${r.id}?created=1`)
  }

  return (
    <div>
      <PageHeader back="/purchases" title="New Purchase" description="Record a supplier bill. Saving adds the items to your stock." />
      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-4">
          <Panel title="Supplier & Bill Details">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Supplier" required error={errors.party} className="sm:col-span-2" hint={partyId ? <>Current balance: <Money value={balance} kind="balance" /></> : undefined}>
                <PartyPicker value={partyId} onChange={setPartyId} role="supplier" />
              </Field>
              <Field label="Purchase Date" required>
                <Input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} className="h-9" />
              </Field>
              <Field label="Supplier Invoice No.">
                <Input value={billNo} onChange={(e) => setBillNo(e.target.value)} placeholder="e.g. 4521" className="h-9" />
              </Field>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">Our reference: {business.purchasePrefix}{business.nextPurchaseNo}</div>
          </Panel>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Items</h2>
              {errors.items && <span className="text-xs text-destructive">{errors.items}</span>}
            </div>
            <LineItemsEditor lines={lines} onChange={setLines} />
          </div>

          <Field label="Notes">
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Vehicle no., delivery remarks…" />
          </Field>
        </div>

        <div className="xl:sticky xl:top-[4.5rem] xl:self-start">
          <Panel title="Bill Summary">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="num">{npr(t.subtotal)}</span></div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Bill Discount</span>
                <Input type="number" min={0} value={billDiscount} onChange={(e) => setBillDiscount(e.target.value)} placeholder="0" className="h-7 w-28 text-right" />
              </div>
              <div className="flex justify-between"><span className="text-muted-foreground">Total Discount</span><span className="num">{npr(t.discount)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Taxable</span><span className="num">{npr(t.taxable)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">VAT 13%</span><span className="num">{npr(t.tax)}</span></div>
              <div className="flex justify-between border-t pt-2 text-base font-semibold"><span>Grand Total</span><span className="num text-primary">{npr(t.total)}</span></div>
            </div>
            <div className="mt-4 grid gap-3">
              <Field label="Payment Method">
                <SimpleSelect
                  value={method}
                  onChange={(v) => {
                    setMethod(v as PaymentMethod)
                    setPaidInput(v === "credit" ? "0" : String(t.total))
                  }}
                  options={methods.filter((m) => m.enabled).map((m) => ({ value: m.value, label: m.label }))}
                />
              </Field>
              <Field label="Amount Paid Now">
                <div className="flex gap-1.5">
                  <Input type="number" min={0} value={paidInput} onChange={(e) => setPaidInput(e.target.value)} className="h-9 text-right" />
                  <Button type="button" variant="outline" className="h-9" onClick={() => { setPaidInput(String(t.total)); if (method === "credit") setMethod("cash") }}>Full</Button>
                </div>
              </Field>
              <div className={cn("flex items-center justify-between rounded-md px-3 py-2 text-sm font-semibold", t.total === 0 ? "bg-muted text-muted-foreground" : due > 0 ? "bg-destructive/5 text-destructive" : "bg-success/10 text-success")}>
                <span>{t.total === 0 ? "Amount due" : due > 0 ? "Due to supplier" : "Fully paid"}</span>
                <span className="num">{npr(due)}</span>
              </div>
              <Button className="h-10" onClick={save}><Save /> Save Purchase</Button>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}
