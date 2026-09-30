"use client"

import { Suspense, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { AlertTriangle, CheckCircle2, Factory, Play, Save } from "lucide-react"
import { npr, qty as fmtQty, round2, todayISO } from "@/lib/format"
import { useProductMap, useStockMap } from "@/lib/hooks"
import { useStore } from "@/lib/store"
import { useUI } from "@/lib/ui-store"
import type { ProductionStatus } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, PageHeader, Panel } from "@/components/shared/ui-bits"
import { SimpleSelect } from "@/components/shared/filters"

export default function NewProductionPage() {
  return (
    <Suspense>
      <ProductionForm />
    </Suspense>
  )
}

function ProductionForm() {
  const router = useRouter()
  const params = useSearchParams()
  const boms = useStore((s) => s.boms)
  const createProduction = useStore((s) => s.createProduction)
  const business = useStore((s) => s.business)
  const openDialog = useUI((s) => s.openDialog)
  const productMap = useProductMap()
  const stock = useStockMap()

  const [bomId, setBomId] = useState(params.get("bom") ?? boms[0]?.id ?? "")
  const [qtyInput, setQtyInput] = useState("50")
  const [date, setDate] = useState(todayISO())
  const [notes, setNotes] = useState("")
  const [actualOverride, setActualOverride] = useState<Record<string, string>>({})
  const [overheadOverride, setOverheadOverride] = useState<string | null>(null)

  const bom = boms.find((b) => b.id === bomId)
  const q = Number(qtyInput) || 0
  const batches = bom ? q / bom.outputQty : 0
  const finished = bom ? productMap[bom.productId] : undefined

  const materials = useMemo(
    () =>
      (bom?.items ?? []).map((it) => {
        const required = round2(it.qty * batches)
        const actualStr = actualOverride[it.productId]
        const actual = actualStr === undefined || actualStr === "" ? required : Number(actualStr) || 0
        const p = productMap[it.productId]
        const available = stock[it.productId] ?? 0
        return { productId: it.productId, p, required, actual, available, rate: p?.purchasePrice ?? 0, short: actual > available }
      }),
    [bom, batches, actualOverride, productMap, stock],
  )
  const overhead = overheadOverride === null ? round2((bom?.overheadCost ?? 0) * batches) : Number(overheadOverride) || 0
  const materialCost = round2(materials.reduce((s, m) => s + m.actual * m.rate, 0))
  const total = round2(materialCost + overhead)
  const perUnit = q > 0 ? total / q : 0
  const anyShort = materials.some((m) => m.short)

  const save = (status: ProductionStatus) => {
    if (!bom) return toast.error("Select a Bill of Materials")
    if (q <= 0) return toast.error("Enter production quantity")
    if (status === "completed" && anyShort) return toast.error("Not enough raw material in stock to complete this production")
    const r = createProduction({
      date, bomId, qty: q, overheadCost: overhead, notes, status,
      materials: materials.map((m) => ({ productId: m.productId, required: m.required, actual: m.actual })),
    })
    if (!r.ok) return toast.error(r.error)
    toast.success(status === "completed" ? "Production completed — stock updated" : status === "in_progress" ? "Production started" : "Saved as draft")
    router.push(`/manufacturing/${r.id}?created=1`)
  }

  if (!boms.length)
    return (
      <div>
        <PageHeader back="/manufacturing" title="New Production" />
        <Panel>
          <div className="py-8 text-center">
            <p className="mb-3 text-sm text-muted-foreground">Create a Bill of Materials first.</p>
            <Button onClick={() => openDialog({ kind: "bom" })}>New BOM</Button>
          </div>
        </Panel>
      </div>
    )

  return (
    <div>
      <PageHeader back="/manufacturing" title="New Production Entry" description={`Production ID PRD-${business.nextProductionNo} · raw materials are deducted only when production is completed.`} />
      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-4">
          <Panel title="Production Details">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Finished Product (BOM)" required className="sm:col-span-2">
                <SimpleSelect
                  value={bomId}
                  onChange={(v) => {
                    setBomId(v)
                    setActualOverride({})
                    setOverheadOverride(null)
                  }}
                  options={boms.map((b) => ({ value: b.id, label: `${productMap[b.productId]?.name} — ${b.name}` }))}
                />
              </Field>
              <Field label={`Production Quantity${finished ? ` (${finished.unit})` : ""}`} required>
                <Input type="number" min={0} step="any" value={qtyInput} onChange={(e) => { setQtyInput(e.target.value); setActualOverride({}); setOverheadOverride(null) }} className="h-9" />
              </Field>
              <Field label="Production Date" required>
                <Input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} className="h-9" />
              </Field>
            </div>
            {finished && (
              <div className="mt-3 text-xs text-muted-foreground">
                Current stock of {finished.name}: <b className="text-foreground">{fmtQty(stock[finished.id] ?? 0)} {finished.unit}</b> → after production{" "}
                <b className="text-success">{fmtQty((stock[finished.id] ?? 0) + q)} {finished.unit}</b>
              </div>
            )}
          </Panel>

          <Panel title="Raw Materials" description="Required quantity is calculated from the BOM. Change actual quantity if there was wastage." bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground uppercase">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold">Raw Material</th>
                    <th className="px-4 py-2 text-right font-semibold">In Stock</th>
                    <th className="px-4 py-2 text-right font-semibold">Required</th>
                    <th className="w-36 px-4 py-2 text-right font-semibold">Actual Used</th>
                    <th className="px-4 py-2 text-right font-semibold">Rate</th>
                    <th className="px-4 py-2 text-right font-semibold">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.map((m) => (
                    <tr key={m.productId} className={cn("border-t", m.short && "bg-destructive/5")}>
                      <td className="px-4 py-2">
                        <div className="font-medium">{m.p?.name}</div>
                        {m.short && <div className="flex items-center gap-1 text-xs text-destructive"><AlertTriangle className="size-3" /> Short by {fmtQty(round2(m.actual - m.available))} {m.p?.unit}</div>}
                      </td>
                      <td className="num px-4 py-2 text-right text-muted-foreground">{fmtQty(m.available)} {m.p?.unit}</td>
                      <td className="num px-4 py-2 text-right">{fmtQty(m.required)} {m.p?.unit}</td>
                      <td className="px-4 py-1.5">
                        <Input
                          type="number"
                          min={0}
                          step="any"
                          value={actualOverride[m.productId] ?? String(m.required)}
                          onChange={(e) => setActualOverride({ ...actualOverride, [m.productId]: e.target.value })}
                          className="h-8 text-right"
                        />
                      </td>
                      <td className="num px-4 py-2 text-right text-muted-foreground">{npr(m.rate)}</td>
                      <td className="num px-4 py-2 text-right font-medium">{npr(m.actual * m.rate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Field label="Notes">
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Machine, shift, batch remarks…" />
          </Field>
        </div>

        <div className="xl:sticky xl:top-[4.5rem] xl:self-start">
          <Panel title="Production Cost">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Raw material cost</span><span className="num">{npr(materialCost)}</span></div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Labour & overhead</span>
                <Input type="number" min={0} value={overheadOverride ?? String(overhead)} onChange={(e) => setOverheadOverride(e.target.value)} className="h-7 w-28 text-right" />
              </div>
              <div className="flex justify-between border-t pt-2 text-base font-semibold"><span>Total Cost</span><span className="num">{npr(total)}</span></div>
              <div className="flex justify-between font-semibold text-primary"><span>Cost per {finished?.unit ?? "unit"}</span><span className="num">{npr(perUnit)}</span></div>
              {finished && finished.sellingPrice > 0 && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Selling price {npr(finished.sellingPrice)}</span>
                  <span>Expected profit {npr((finished.sellingPrice - perUnit) * q)}</span>
                </div>
              )}
            </div>
            <div className={cn("mt-4 flex items-start gap-2 rounded-md p-3 text-xs", anyShort ? "bg-destructive/5 text-destructive" : "bg-success/10 text-success")}>
              {anyShort ? <AlertTriangle className="size-4 shrink-0" /> : <CheckCircle2 className="size-4 shrink-0" />}
              {anyShort ? "Some raw materials are short. You can save as draft and purchase the materials first." : "All raw materials are available in stock."}
            </div>
            <div className="mt-4 grid gap-2">
              <Button className="h-10" onClick={() => save("completed")} disabled={anyShort}><Factory /> Complete Production</Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="h-9" onClick={() => save("in_progress")}><Play /> Start</Button>
                <Button variant="outline" className="h-9" onClick={() => save("draft")}><Save /> Save Draft</Button>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}
