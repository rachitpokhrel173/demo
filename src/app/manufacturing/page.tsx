"use client"

import { Suspense, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { ClipboardList, Factory, Layers, Pencil, Play, Plus, Trash2 } from "lucide-react"
import { fmtDate, npr, qty } from "@/lib/format"
import { stockStatus } from "@/lib/ledger"
import { useProductMap, useStockMap } from "@/lib/hooks"
import { useStore } from "@/lib/store"
import { confirmAction, useUI } from "@/lib/ui-store"
import type { ProductionStatus } from "@/lib/types"
import { useProductionActions } from "@/components/manufacturing/use-production-actions"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DataTable } from "@/components/shared/data-table"
import { FilterBar, SearchInput, Segmented, inRange, rangeFor } from "@/components/shared/filters"
import { EmptyState, PageHeader, Panel, StatCard } from "@/components/shared/ui-bits"
import { StatusBadge } from "@/components/shared/status-badge"

export default function ManufacturingPage() {
  return (
    <Suspense>
      <Manufacturing />
    </Suspense>
  )
}

function Manufacturing() {
  const router = useRouter()
  const params = useSearchParams()
  const productions = useStore((s) => s.productions)
  const boms = useStore((s) => s.boms)
  const products = useStore((s) => s.products)
  const deleteBom = useStore((s) => s.deleteBom)
  const openDialog = useUI((s) => s.openDialog)
  const productMap = useProductMap()
  const stock = useStockMap()
  const act = useProductionActions()
  const [q, setQ] = useState("")
  const [status, setStatus] = useState<"all" | ProductionStatus>("all")

  const month = rangeFor("30d")
  const completedMonth = productions.filter((p) => p.status === "completed" && inRange(p.date, month))
  const rawMaterials = products.filter((p) => p.kind === "raw")
  const finished = products.filter((p) => p.kind === "finished")

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase()
    return [...productions].reverse().filter((p) => (status === "all" || p.status === status) && (!s || p.number.toLowerCase().includes(s) || productMap[p.productId]?.name.toLowerCase().includes(s)))
  }, [productions, status, q, productMap])

  const bomCost = (b: (typeof boms)[number]) => b.items.reduce((s, it) => s + (productMap[it.productId]?.purchasePrice ?? 0) * it.qty, 0) + b.overheadCost
  const maxBatches = (b: (typeof boms)[number]) => Math.floor(Math.min(...b.items.map((it) => (stock[it.productId] ?? 0) / it.qty)) * b.outputQty)

  return (
    <div>
      <PageHeader
        title="Manufacturing"
        description="Turn raw materials into finished goods using Bills of Materials."
        actions={
          <>
            <Button variant="outline" className="h-9" onClick={() => openDialog({ kind: "bom" })}><Layers /> New BOM</Button>
            <Button className="h-9" render={<Link href="/manufacturing/new" />} nativeButton={false}><Plus /> New Production</Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Productions (30 days)" value={completedMonth.length} icon={Factory} tone="primary" hint={`${productions.filter((p) => p.status === "in_progress").length} in progress · ${productions.filter((p) => p.status === "draft").length} draft`} />
        <StatCard label="Units produced (30 days)" value={qty(completedMonth.reduce((s, p) => s + p.qty, 0))} icon={ClipboardList} hint={finished.map((f) => `${f.name.split(" — ")[0].replace("Finished ", "")}`).join(" · ")} />
        <StatCard label="Production cost (30 days)" value={npr(completedMonth.reduce((s, p) => s + p.totalCost, 0))} tone="warning" />
        <StatCard label="Raw material stock value" value={npr(rawMaterials.reduce((s, p) => s + Math.max(0, stock[p.id] ?? 0) * p.purchasePrice, 0))} tone="success" hint={`${rawMaterials.length} raw materials`} />
      </div>

      <Tabs defaultValue={params.get("tab") ?? "production"}>
        <TabsList variant="line" className="mb-3 w-full justify-start overflow-x-auto overflow-y-hidden border-b pb-1.5 group-data-horizontal/tabs:h-auto">
          <TabsTrigger value="production" className="flex-none px-3">Production History</TabsTrigger>
          <TabsTrigger value="bom" className="flex-none px-3">Bill of Materials ({boms.length})</TabsTrigger>
          <TabsTrigger value="materials" className="flex-none px-3">Raw Materials & Finished Goods</TabsTrigger>
        </TabsList>

        <TabsContent value="production">
          <FilterBar>
            <SearchInput value={q} onChange={setQ} placeholder="Search production ID or product" />
            <Segmented
              value={status}
              onChange={setStatus}
              options={[
                { value: "all", label: "All" },
                { value: "draft", label: "Draft" },
                { value: "in_progress", label: "In Progress" },
                { value: "completed", label: "Completed" },
                { value: "cancelled", label: "Cancelled" },
              ]}
            />
          </FilterBar>
          <DataTable
            rows={rows}
            getRowId={(r) => r.id}
            onRowClick={(r) => router.push(`/manufacturing/${r.id}`)}
            emptyTitle="No production entries"
            emptyAction={<Button render={<Link href="/manufacturing/new" />} nativeButton={false}><Plus /> New Production</Button>}
            columns={[
              { key: "no", header: "Production ID", cell: (r) => <span className="font-medium text-primary">{r.number}</span> },
              { key: "date", header: "Date", cell: (r) => fmtDate(r.date) },
              { key: "product", header: "Product", cell: (r) => <span className="block max-w-72 truncate">{productMap[r.productId]?.name}</span> },
              { key: "qty", header: "Quantity", align: "right", cell: (r) => <span className="num font-medium">{qty(r.qty)} {productMap[r.productId]?.unit}</span> },
              { key: "cost", header: "Cost", align: "right", cell: (r) => <span className="num">{npr(r.totalCost)}</span> },
              { key: "unit", header: "Cost / Unit", align: "right", cell: (r) => <span className="num text-muted-foreground">{npr(r.totalCost / r.qty)}</span> },
              { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
              {
                key: "act",
                header: "",
                align: "right",
                cell: (r) => (
                  <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    {r.status === "draft" && <Button size="xs" variant="outline" onClick={() => act(r, "in_progress")}><Play /> Start</Button>}
                    {(r.status === "draft" || r.status === "in_progress") && <Button size="xs" onClick={() => act(r, "completed")}>Complete</Button>}
                  </div>
                ),
              },
            ]}
          />
        </TabsContent>

        <TabsContent value="bom">
          {boms.length === 0 ? (
            <EmptyState icon={Layers} title="No Bill of Materials yet" description="Create a BOM to define which raw materials make a finished product." action={<Button onClick={() => openDialog({ kind: "bom" })}><Plus /> New BOM</Button>} />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {boms.map((b) => {
                const fp = productMap[b.productId]
                const cost = bomCost(b)
                const perUnit = cost / b.outputQty
                return (
                  <Panel
                    key={b.id}
                    title={fp?.name}
                    description={`${b.name} · Output ${b.outputQty} ${fp?.unit} per batch`}
                    bodyClassName="p-0"
                    actions={
                      <>
                        <Button variant="ghost" size="icon-sm" onClick={() => openDialog({ kind: "bom", bom: b })} aria-label="Edit BOM"><Pencil /></Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Delete BOM"
                          onClick={async () => {
                            if (!(await confirmAction({ title: "Delete this BOM?", confirmText: "Delete", destructive: true }))) return
                            const r = deleteBom(b.id)
                            if (r.ok) toast.success("BOM deleted")
                            else toast.error(r.error)
                          }}
                        >
                          <Trash2 />
                        </Button>
                      </>
                    }
                  >
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 text-xs text-muted-foreground uppercase">
                        <tr>
                          <th className="px-4 py-2 text-left font-semibold">Raw Material</th>
                          <th className="px-4 py-2 text-right font-semibold">Required</th>
                          <th className="px-4 py-2 text-right font-semibold">Rate</th>
                          <th className="px-4 py-2 text-right font-semibold">Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {b.items.map((it) => {
                          const rp = productMap[it.productId]
                          return (
                            <tr key={it.productId} className="border-t">
                              <td className="px-4 py-2"><Link href={`/products/${it.productId}`} className="hover:underline">{rp?.name}</Link></td>
                              <td className="num px-4 py-2 text-right">{qty(it.qty)} {rp?.unit}</td>
                              <td className="num px-4 py-2 text-right text-muted-foreground">{npr(rp?.purchasePrice ?? 0)}</td>
                              <td className="num px-4 py-2 text-right">{npr((rp?.purchasePrice ?? 0) * it.qty)}</td>
                            </tr>
                          )
                        })}
                        <tr className="border-t">
                          <td className="px-4 py-2 text-muted-foreground" colSpan={3}>Labour & overhead</td>
                          <td className="num px-4 py-2 text-right">{npr(b.overheadCost)}</td>
                        </tr>
                      </tbody>
                    </table>
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/30 px-4 py-3">
                      <div>
                        <div className="text-xs text-muted-foreground">Estimated production cost</div>
                        <div className="num text-base font-semibold">{npr(perUnit)} <span className="text-xs font-normal text-muted-foreground">/ {fp?.unit}</span></div>
                        <div className="text-xs text-muted-foreground">
                          Sells at {npr(fp?.sellingPrice ?? 0)} · margin {fp?.sellingPrice ? Math.round(((fp.sellingPrice - perUnit) / fp.sellingPrice) * 100) : 0}% · can make ~{qty(Math.max(0, maxBatches(b)))} with current stock
                        </div>
                      </div>
                      <Button size="sm" render={<Link href={`/manufacturing/new?bom=${b.id}`} />} nativeButton={false}><Factory /> Produce</Button>
                    </div>
                  </Panel>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="materials">
          <div className="grid gap-4 lg:grid-cols-2">
            {[
              { title: "Raw Materials", list: rawMaterials },
              { title: "Finished Goods", list: finished },
            ].map((g) => (
              <Panel key={g.title} title={g.title} bodyClassName="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground uppercase">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold">Product</th>
                      <th className="px-4 py-2 text-right font-semibold">Stock</th>
                      <th className="px-4 py-2 text-right font-semibold">Value</th>
                      <th className="px-4 py-2 text-left font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.list.map((p) => (
                      <tr key={p.id} className="border-t">
                        <td className="px-4 py-2.5"><Link href={`/products/${p.id}`} className="font-medium hover:underline">{p.name}</Link></td>
                        <td className="num px-4 py-2.5 text-right font-semibold">{qty(stock[p.id] ?? 0)} <span className="text-xs font-normal text-muted-foreground">{p.unit}</span></td>
                        <td className="num px-4 py-2.5 text-right">{npr(Math.max(0, stock[p.id] ?? 0) * p.purchasePrice)}</td>
                        <td className="px-4 py-2.5"><StatusBadge status={stockStatus(p, stock[p.id] ?? 0)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Panel>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
