"use client"

import { useMemo } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { PackageX, Pencil, ShoppingCart, SlidersHorizontal, Truck } from "lucide-react"
import { fmtDate, npr, qty, round2 } from "@/lib/format"
import { MOVE_LABEL, stockStatus } from "@/lib/ledger"
import { usePartyMap, useProductMap, useStockMap } from "@/lib/hooks"
import { useStore } from "@/lib/store"
import { useUI } from "@/lib/ui-store"
import type { StockMovement } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DataTable } from "@/components/shared/data-table"
import { EmptyState, KeyValue, PageHeader, Panel, StatCard } from "@/components/shared/ui-bits"
import { StatusBadge } from "@/components/shared/status-badge"
import { SERIES, TrendChart } from "@/components/shared/charts"

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const product = useStore((s) => s.products.find((p) => p.id === id))
  const moves = useStore((s) => s.stockMovements)
  const invoices = useStore((s) => s.invoices)
  const purchases = useStore((s) => s.purchases)
  const productions = useStore((s) => s.productions)
  const boms = useStore((s) => s.boms)
  const openDialog = useUI((s) => s.openDialog)
  const stock = useStockMap()
  const partyMap = usePartyMap()
  const productMap = useProductMap()

  const history = useMemo(() => {
    const sorted = moves.filter((m) => m.productId === id).sort((a, b) => a.date.localeCompare(b.date))
    const out: (StockMovement & { balance: number })[] = []
    for (const m of sorted) out.push({ ...m, balance: round2((out[out.length - 1]?.balance ?? 0) + m.qty) })
    return out.reverse()
  }, [moves, id])

  const sales = useMemo(
    () => invoices.filter((i) => !i.cancelled).flatMap((i) => i.items.filter((it) => it.productId === id).map((it, k) => ({ key: `${i.id}-${k}`, inv: i, it }))).reverse(),
    [invoices, id],
  )
  const buys = useMemo(
    () => purchases.filter((p) => !p.cancelled).flatMap((p) => p.items.filter((it) => it.productId === id).map((it, k) => ({ key: `${p.id}-${k}`, pur: p, it }))).reverse(),
    [purchases, id],
  )
  const mfg = useMemo(
    () =>
      productions
        .filter((p) => p.productId === id || p.materials.some((m) => m.productId === id))
        .map((p) => ({ p, role: p.productId === id ? "Produced" : "Consumed", q: p.productId === id ? p.qty : p.materials.find((m) => m.productId === id)!.actual }))
        .reverse(),
    [productions, id],
  )
  const usedIn = boms.filter((b) => b.items.some((i) => i.productId === id))
  const priceHistory = useMemo(
    () =>
      moves
        .filter((m) => m.productId === id && (m.type === "purchase" || m.type === "production_in" || m.type === "opening"))
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((m) => ({ label: fmtDate(m.date, "dd MMM"), rate: m.rate, date: m.date, ref: m.reference })),
    [moves, id],
  )

  if (!product) return <EmptyState icon={PackageX} title="Product not found" action={<Button render={<Link href="/products" />} nativeButton={false}>Back to products</Button>} />

  const current = stock[product.id] ?? 0
  const st = stockStatus(product, current)
  const margin = product.sellingPrice - product.purchasePrice
  const soldQty = sales.reduce((s, x) => s + x.it.qty, 0)

  return (
    <div>
      <PageHeader
        back="/products"
        title={<span className="flex flex-wrap items-center gap-2">{product.name} <StatusBadge status={st} /></span>}
        description={`${product.sku} · ${product.category} · ${product.unit}`}
        actions={
          <>
            {product.kind !== "raw" && <Button className="h-9" render={<Link href="/sales" />} nativeButton={false}><ShoppingCart /> Sell</Button>}
            {product.kind !== "finished" && <Button variant="outline" className="h-9" render={<Link href={`/purchases/new?product=${product.id}`} />} nativeButton={false}><Truck /> Purchase</Button>}
            <Button variant="outline" className="h-9" onClick={() => openDialog({ kind: "stock", mode: "adjust", productId: product.id })}><SlidersHorizontal /> Adjust Stock</Button>
            <Button variant="ghost" size="icon" className="size-9" onClick={() => openDialog({ kind: "product", product })} aria-label="Edit"><Pencil /></Button>
          </>
        }
      />
      <div className="mb-4 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Current Stock" value={`${qty(current)} ${product.unit}`} hint={`Minimum ${qty(product.minStock)} ${product.unit}`} tone={st === "in" ? "success" : st === "low" ? "warning" : "danger"} />
        <StatCard label="Stock Value (at cost)" value={npr(Math.max(0, current) * product.purchasePrice)} hint={`@ ${npr(product.purchasePrice)} / ${product.unit}`} />
        <StatCard label="Selling Price" value={product.sellingPrice ? npr(product.sellingPrice) : "—"} hint={product.sellingPrice ? `Margin ${npr(margin)} (${Math.round((margin / product.sellingPrice) * 100)}%)` : "Not for sale"} />
        <StatCard label="Total Sold" value={`${qty(soldQty)} ${product.unit}`} hint={`${sales.length} invoice lines`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[300px_1fr]">
        <Panel title="Product Details">
          <div className="grid grid-cols-2 gap-4">
            <KeyValue label="SKU" value={product.sku} />
            <KeyValue label="Barcode" value={product.barcode} />
            <KeyValue label="Category" value={product.category} />
            <KeyValue label="Unit" value={product.unit} />
            <KeyValue label="Type" value={<StatusBadge status={product.kind} />} />
            <KeyValue label="VAT" value={`${product.vatRate}%`} />
            <KeyValue label="Purchase Price" value={npr(product.purchasePrice)} />
            <KeyValue label="Selling Price" value={product.sellingPrice ? npr(product.sellingPrice) : "—"} />
            <KeyValue label="Opening Stock" value={`${qty(product.openingStock)} ${product.unit}`} />
            <KeyValue label="Status" value={<StatusBadge status={product.status} />} />
          </div>
          {usedIn.length > 0 && (
            <div className="mt-4 border-t pt-3">
              <div className="mb-1 text-xs text-muted-foreground">Used in BOM</div>
              {usedIn.map((b) => (
                <Link key={b.id} href="/manufacturing?tab=bom" className="block text-sm text-primary hover:underline">
                  {productMap[b.productId]?.name} — {b.items.find((i) => i.productId === id)?.qty} {product.unit} per {productMap[b.productId]?.unit}
                </Link>
              ))}
            </div>
          )}
        </Panel>

        <div className="min-w-0">
          <Tabs defaultValue="stock">
            <TabsList variant="line" className="mb-2 w-full justify-start overflow-x-auto overflow-y-hidden border-b pb-1.5 group-data-horizontal/tabs:h-auto">
              <TabsTrigger value="stock" className="flex-none px-3">Stock History</TabsTrigger>
              <TabsTrigger value="sales" className="flex-none px-3">Sales ({sales.length})</TabsTrigger>
              <TabsTrigger value="purchases" className="flex-none px-3">Purchases ({buys.length})</TabsTrigger>
              <TabsTrigger value="mfg" className="flex-none px-3">Manufacturing ({mfg.length})</TabsTrigger>
              <TabsTrigger value="price" className="flex-none px-3">Price History</TabsTrigger>
            </TabsList>
            <TabsContent value="stock">
              <DataTable
                rows={history}
                getRowId={(r) => r.id}
                pageSize={12}
                emptyTitle="No stock movement"
                columns={[
                  { key: "date", header: "Date", cell: (r) => fmtDate(r.date) },
                  { key: "type", header: "Transaction", cell: (r) => <StatusBadge label={MOVE_LABEL[r.type]} tone={r.qty > 0 ? "green" : "red"} /> },
                  { key: "ref", header: "Reference", cell: (r) => <span className="font-medium">{r.reference}</span> },
                  { key: "in", header: "In", align: "right", cell: (r) => (r.qty > 0 ? <span className="num text-success">+{qty(r.qty)}</span> : "") },
                  { key: "out", header: "Out", align: "right", cell: (r) => (r.qty < 0 ? <span className="num text-destructive">−{qty(-r.qty)}</span> : "") },
                  { key: "bal", header: "Balance", align: "right", cell: (r) => <span className="num font-semibold">{qty(r.balance)}</span> },
                  { key: "note", header: "Note", cell: (r) => <span className="text-xs text-muted-foreground">{r.note ?? ""}</span> },
                ]}
              />
            </TabsContent>
            <TabsContent value="sales">
              <DataTable
                rows={sales}
                getRowId={(r) => r.key}
                pageSize={12}
                onRowClick={(r) => router.push(`/invoices/${r.inv.id}`)}
                emptyTitle="Not sold yet"
                columns={[
                  { key: "date", header: "Date", cell: (r) => fmtDate(r.inv.date) },
                  { key: "inv", header: "Invoice", cell: (r) => <span className="font-medium text-primary">{r.inv.number}</span> },
                  { key: "cust", header: "Customer", cell: (r) => r.inv.customerName },
                  { key: "qty", header: "Qty", align: "right", cell: (r) => `${qty(r.it.qty)} ${r.it.unit}` },
                  { key: "rate", header: "Rate", align: "right", cell: (r) => npr(r.it.rate) },
                  { key: "amt", header: "Amount", align: "right", cell: (r) => <span className="num font-medium">{npr(r.it.qty * r.it.rate - r.it.discount)}</span> },
                ]}
              />
            </TabsContent>
            <TabsContent value="purchases">
              <DataTable
                rows={buys}
                getRowId={(r) => r.key}
                pageSize={12}
                onRowClick={(r) => router.push(`/purchases/${r.pur.id}`)}
                emptyTitle="No purchases for this product"
                columns={[
                  { key: "date", header: "Date", cell: (r) => fmtDate(r.pur.date) },
                  { key: "pur", header: "Purchase", cell: (r) => <span className="font-medium text-primary">{r.pur.number}</span> },
                  { key: "sup", header: "Supplier", cell: (r) => partyMap[r.pur.partyId]?.name },
                  { key: "qty", header: "Qty", align: "right", cell: (r) => `${qty(r.it.qty)} ${r.it.unit}` },
                  { key: "rate", header: "Rate", align: "right", cell: (r) => npr(r.it.rate) },
                  { key: "amt", header: "Amount", align: "right", cell: (r) => <span className="num font-medium">{npr(r.it.qty * r.it.rate - r.it.discount)}</span> },
                ]}
              />
            </TabsContent>
            <TabsContent value="mfg">
              <DataTable
                rows={mfg}
                getRowId={(r) => r.p.id}
                pageSize={12}
                emptyTitle="Not used in manufacturing"
                emptyDescription="Raw materials and finished goods show their production usage here."
                onRowClick={() => router.push("/manufacturing")}
                columns={[
                  { key: "date", header: "Date", cell: (r) => fmtDate(r.p.date) },
                  { key: "no", header: "Production", cell: (r) => <span className="font-medium">{r.p.number}</span> },
                  { key: "for", header: "Finished Product", cell: (r) => productMap[r.p.productId]?.name },
                  { key: "role", header: "Role", cell: (r) => <StatusBadge label={r.role} tone={r.role === "Produced" ? "green" : "amber"} /> },
                  { key: "qty", header: "Quantity", align: "right", cell: (r) => `${qty(r.q)} ${product.unit}` },
                  { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.p.status} /> },
                ]}
              />
            </TabsContent>
            <TabsContent value="price">
              <Panel title="Cost price trend" description="Purchase rate / production cost per unit">
                {priceHistory.length > 1 ? (
                  <TrendChart type="line" data={priceHistory} series={[{ key: "rate", name: "Cost / unit", color: SERIES.sales }]} height={220} />
                ) : (
                  <div className="py-8 text-center text-sm text-muted-foreground">Not enough price history yet.</div>
                )}
                <div className="mt-3 max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <tbody>
                      {[...priceHistory].reverse().map((p, i, arr) => {
                        const prev = arr[i + 1]?.rate
                        const diff = prev ? p.rate - prev : 0
                        return (
                          <tr key={i} className="border-b last:border-0">
                            <td className="py-1.5">{fmtDate(p.date)}</td>
                            <td className="py-1.5 text-muted-foreground">{p.ref}</td>
                            <td className="num py-1.5 text-right font-medium">{npr(p.rate)}</td>
                            <td className={cn("num w-24 py-1.5 text-right text-xs", diff > 0 ? "text-destructive" : diff < 0 ? "text-success" : "text-muted-foreground")}>
                              {diff ? `${diff > 0 ? "▲" : "▼"} ${npr(Math.abs(diff))}` : "—"}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
