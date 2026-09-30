"use client"

import { Suspense } from "react"
import Link from "next/link"
import { useParams, useSearchParams } from "next/navigation"
import { ArrowDown, ArrowUp, Ban, CheckCircle2, Factory, FileX, Play, Printer } from "lucide-react"
import { fmtDate, npr, qty, round2 } from "@/lib/format"
import { useProductMap, useStockMap } from "@/lib/hooks"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { EmptyState, KeyValue, PageHeader, Panel, StatCard } from "@/components/shared/ui-bits"
import { StatusBadge } from "@/components/shared/status-badge"
import { useProductionActions } from "@/components/manufacturing/use-production-actions"

export default function ProductionDetailPage() {
  return (
    <Suspense>
      <ProductionDetail />
    </Suspense>
  )
}

function ProductionDetail() {
  const { id } = useParams<{ id: string }>()
  const params = useSearchParams()
  const prd = useStore((s) => s.productions.find((p) => p.id === id))
  const bom = useStore((s) => s.boms.find((b) => b.id === prd?.bomId))
  const productMap = useProductMap()
  const stock = useStockMap()
  const act = useProductionActions()

  if (!prd) return <EmptyState icon={FileX} title="Production not found" action={<Button render={<Link href="/manufacturing" />} nativeButton={false}>Back</Button>} />

  const fp = productMap[prd.productId]
  const done = prd.status === "completed"
  const open = prd.status === "draft" || prd.status === "in_progress"

  return (
    <div>
      <PageHeader
        back="/manufacturing"
        title={<span className="flex items-center gap-2">Production {prd.number} <StatusBadge status={prd.status} /></span>}
        description={`${fp?.name} · ${fmtDate(prd.date)}${bom ? ` · BOM: ${bom.name}` : ""}`}
        actions={
          <>
            <Button variant="outline" className="h-9" onClick={() => window.print()}><Printer /> Print</Button>
            {prd.status === "draft" && <Button variant="outline" className="h-9" onClick={() => act(prd, "in_progress")}><Play /> Start</Button>}
            {open && <Button variant="outline" className="h-9" onClick={() => act(prd, "cancelled")}><Ban /> Cancel</Button>}
            {open && <Button className="h-9" onClick={() => act(prd, "completed")}><Factory /> Complete Production</Button>}
          </>
        }
      />

      {params.get("created") === "1" && (
        <div className={cn("mb-4 flex items-start gap-3 rounded-lg border p-4 print:hidden", done ? "border-success/30 bg-success/5" : "border-primary/30 bg-primary/5")}>
          <CheckCircle2 className={cn("mt-0.5 size-5", done ? "text-success" : "text-primary")} />
          <div className="text-sm">
            <div className="font-semibold">{done ? "Production completed and stock updated" : prd.status === "in_progress" ? "Production started" : "Production saved as draft"}</div>
            <div className="text-muted-foreground">{done ? "Raw materials have been deducted and finished goods added to inventory — see Stock Impact below." : "Stock will change only when you mark it as completed."}</div>
          </div>
        </div>
      )}

      <div className="print-area space-y-4">
        <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Quantity Produced" value={`${qty(prd.qty)} ${fp?.unit}`} tone="primary" />
          <StatCard label="Material Cost" value={npr(prd.materialCost)} />
          <StatCard label="Total Production Cost" value={npr(prd.totalCost)} hint={`Incl. overhead ${npr(prd.overheadCost)}`} />
          <StatCard label="Cost per Unit" value={npr(prd.totalCost / prd.qty)} hint={fp?.sellingPrice ? `Sells at ${npr(fp.sellingPrice)}` : undefined} tone="success" />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <Panel title="Raw Material Consumption" bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground uppercase">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold">Raw Material</th>
                    <th className="px-4 py-2 text-right font-semibold">Required</th>
                    <th className="px-4 py-2 text-right font-semibold">Actual</th>
                    <th className="px-4 py-2 text-right font-semibold">Variance</th>
                    <th className="px-4 py-2 text-right font-semibold">Rate</th>
                    <th className="px-4 py-2 text-right font-semibold">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {prd.materials.map((m) => {
                    const p = productMap[m.productId]
                    const v = round2(m.actual - m.required)
                    return (
                      <tr key={m.productId} className="border-t">
                        <td className="px-4 py-2"><Link href={`/products/${m.productId}`} className="font-medium hover:underline">{p?.name}</Link></td>
                        <td className="num px-4 py-2 text-right">{qty(m.required)} {p?.unit}</td>
                        <td className="num px-4 py-2 text-right font-medium">{qty(m.actual)} {p?.unit}</td>
                        <td className={cn("num px-4 py-2 text-right text-xs", v > 0 ? "text-destructive" : v < 0 ? "text-success" : "text-muted-foreground")}>{v ? `${v > 0 ? "+" : ""}${qty(v)}` : "—"}</td>
                        <td className="num px-4 py-2 text-right text-muted-foreground">{npr(m.rate)}</td>
                        <td className="num px-4 py-2 text-right">{npr(m.actual * m.rate)}</td>
                      </tr>
                    )
                  })}
                  <tr className="border-t">
                    <td className="px-4 py-2 text-muted-foreground" colSpan={5}>Labour & overhead</td>
                    <td className="num px-4 py-2 text-right">{npr(prd.overheadCost)}</td>
                  </tr>
                  <tr className="border-t bg-muted/30 font-semibold">
                    <td className="px-4 py-2" colSpan={5}>Total Production Cost</td>
                    <td className="num px-4 py-2 text-right">{npr(prd.totalCost)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Panel>

          <div className="space-y-4">
            <Panel title="Stock Impact" description={done ? "Applied to inventory" : "Will apply when completed"}>
              <ul className="space-y-2.5 text-sm">
                {prd.materials.map((m) => {
                  const p = productMap[m.productId]
                  return (
                    <li key={m.productId} className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <ArrowDown className="size-3.5 shrink-0 text-destructive" />
                        <span className="truncate">{p?.name}</span>
                      </span>
                      <span className="num shrink-0 text-right">
                        <span className="text-destructive">−{qty(m.actual)}</span>
                        <span className="ml-2 text-xs text-muted-foreground">now {qty(stock[m.productId] ?? 0)} {p?.unit}</span>
                      </span>
                    </li>
                  )
                })}
                <li className="flex items-center justify-between gap-2 border-t pt-2.5 font-medium">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <ArrowUp className="size-3.5 shrink-0 text-success" />
                    <span className="truncate">{fp?.name}</span>
                  </span>
                  <span className="num shrink-0 text-right">
                    <span className="text-success">+{qty(prd.qty)}</span>
                    <span className="ml-2 text-xs font-normal text-muted-foreground">now {qty(stock[prd.productId] ?? 0)} {fp?.unit}</span>
                  </span>
                </li>
              </ul>
              {!done && <p className="mt-3 text-xs text-muted-foreground">Status is {prd.status.replace("_", " ")} — no stock has been changed yet.</p>}
            </Panel>
            <Panel title="Details">
              <div className="grid grid-cols-2 gap-4">
                <KeyValue label="Production ID" value={prd.number} />
                <KeyValue label="Date" value={fmtDate(prd.date)} />
                <KeyValue label="Finished Product" value={fp?.name} className="col-span-2" />
                <KeyValue label="Status" value={<StatusBadge status={prd.status} />} />
                <KeyValue label="BOM" value={bom?.name} />
                {prd.notes && <KeyValue label="Notes" value={prd.notes} className="col-span-2" />}
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  )
}
