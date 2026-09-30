"use client"

import { Suspense, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Boxes, Download, PackageX, SlidersHorizontal, TrendingDown, TrendingUp, Wallet } from "lucide-react"
import { downloadCSV, fmtDate, npr, qty, round2 } from "@/lib/format"
import { MOVE_LABEL, stockStatus, stockValue } from "@/lib/ledger"
import { useProductMap, useStockMap } from "@/lib/hooks"
import { useStore } from "@/lib/store"
import { useUI } from "@/lib/ui-store"
import type { StockMoveType } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DataTable } from "@/components/shared/data-table"
import { DateRangeFilter, FilterBar, SearchInput, Segmented, SimpleSelect, inRange, rangeFor, type DateRange } from "@/components/shared/filters"
import { PageHeader, StatCard } from "@/components/shared/ui-bits"
import { StatusBadge } from "@/components/shared/status-badge"
import { ProductPicker } from "@/components/shared/pickers"

export default function InventoryPage() {
  return (
    <Suspense>
      <Inventory />
    </Suspense>
  )
}

const TYPE_GROUPS: Record<string, StockMoveType[]> = {
  purchase: ["purchase"],
  sale: ["sale", "sale_return"],
  production: ["production_in", "production_out"],
  adjustment: ["adjustment_in", "adjustment_out"],
  manual: ["manual_in", "manual_out"],
  opening: ["opening"],
}

function Inventory() {
  const params = useSearchParams()
  const products = useStore((s) => s.products)
  const moves = useStore((s) => s.stockMovements)
  const openDialog = useUI((s) => s.openDialog)
  const stock = useStockMap()
  const productMap = useProductMap()

  const [q, setQ] = useState("")
  const [stFilter, setStFilter] = useState<"all" | "in" | "low" | "out">((params.get("filter") as "low") ?? "all")
  const [mvProduct, setMvProduct] = useState<string | null>(null)
  const [mvType, setMvType] = useState("all")
  const [range, setRange] = useState<DateRange>(rangeFor("30d"))

  const rows = useMemo(
    () =>
      products.map((p) => {
        const s = stock[p.id] ?? 0
        return { ...p, stock: s, value: round2(Math.max(0, s) * p.purchasePrice), st: stockStatus(p, s) }
      }),
    [products, stock],
  )
  const monthRange = rangeFor("30d")
  const monthMoves = moves.filter((m) => inRange(m.date, monthRange) && m.type !== "opening")
  const valueOf = (list: typeof moves) => list.reduce((s, m) => s + Math.abs(m.qty) * (productMap[m.productId]?.purchasePrice ?? 0), 0)
  const stockInValue = valueOf(monthMoves.filter((m) => m.qty > 0 && !m.type.startsWith("adjustment")))
  const stockOutValue = valueOf(monthMoves.filter((m) => m.qty < 0 && !m.type.startsWith("adjustment")))
  const adjValue = monthMoves.filter((m) => m.type.startsWith("adjustment")).reduce((s, m) => s + m.qty * (productMap[m.productId]?.purchasePrice ?? 0), 0)

  const filteredRows = useMemo(() => {
    const s = q.trim().toLowerCase()
    return rows.filter((r) => (stFilter === "all" || r.st === stFilter) && (!s || r.name.toLowerCase().includes(s) || r.sku.toLowerCase().includes(s)))
  }, [rows, q, stFilter])

  // Stock movement ledger with running balance per product
  const movementRows = useMemo(() => {
    const running: Record<string, number> = {}
    const withBal = [...moves]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((m) => {
        running[m.productId] = round2((running[m.productId] ?? 0) + m.qty)
        return { ...m, balance: running[m.productId] }
      })
    return withBal
      .filter((m) => (!mvProduct || m.productId === mvProduct) && (mvType === "all" || TYPE_GROUPS[mvType].includes(m.type)) && inRange(m.date, range))
      .reverse()
  }, [moves, mvProduct, mvType, range])

  const count = (s: string) => rows.filter((r) => r.st === s).length

  return (
    <div>
      <PageHeader
        title="Inventory / Stock"
        description="Live stock levels, valuation and every stock movement."
        actions={
          <>
            <Button variant="outline" className="h-9" onClick={() => openDialog({ kind: "stock", mode: "in" })}><ArrowDownToLine /> Stock In</Button>
            <Button variant="outline" className="h-9" onClick={() => openDialog({ kind: "stock", mode: "out" })}><ArrowUpFromLine /> Stock Out</Button>
            <Button className="h-9" onClick={() => openDialog({ kind: "stock", mode: "adjust" })}><SlidersHorizontal /> Stock Adjustment</Button>
          </>
        }
      />
      <div className="mb-4 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Current Stock" value={`${rows.filter((r) => r.stock > 0).length} items`} icon={Boxes} hint={`of ${rows.length} products`} />
        <StatCard label="Stock Value" value={npr(stockValue(products, stock))} icon={Wallet} tone="primary" hint="Valued at latest cost price" />
        <StatCard label="Low Stock" value={count("low")} icon={AlertTriangle} tone="warning" href="/inventory?filter=low" />
        <StatCard label="Out of Stock" value={count("out")} icon={PackageX} tone="danger" />
        <StatCard label="Stock In (30 days)" value={npr(stockInValue)} icon={TrendingUp} tone="success" />
        <StatCard label="Stock Out (30 days)" value={npr(stockOutValue)} icon={TrendingDown} hint={`Adjustments ${npr(adjValue)}`} />
      </div>

      <Tabs defaultValue="stock">
        <TabsList variant="line" className="mb-3 w-full justify-start overflow-x-auto overflow-y-hidden border-b pb-1.5 group-data-horizontal/tabs:h-auto">
          <TabsTrigger value="stock" className="flex-none px-3">Current Stock</TabsTrigger>
          <TabsTrigger value="moves" className="flex-none px-3">Stock Movements</TabsTrigger>
        </TabsList>

        <TabsContent value="stock">
          <FilterBar>
            <SearchInput value={q} onChange={setQ} placeholder="Search product or SKU" />
            <Segmented
              value={stFilter}
              onChange={setStFilter}
              options={[
                { value: "all", label: "All", count: rows.length },
                { value: "in", label: "In Stock", count: count("in") },
                { value: "low", label: "Low", count: count("low") },
                { value: "out", label: "Out", count: count("out") },
              ]}
            />
            <Button variant="outline" className="h-9 sm:ml-auto" onClick={() => downloadCSV("stock", [["Product", "SKU", "Unit", "Stock", "Min", "Cost", "Value", "Status"], ...filteredRows.map((r) => [r.name, r.sku, r.unit, r.stock, r.minStock, r.purchasePrice, r.value, r.st])])}>
              <Download /> Export
            </Button>
          </FilterBar>
          <DataTable
            rows={filteredRows}
            getRowId={(r) => r.id}
            pageSize={20}
            initialSort={{ key: "value", dir: "desc" }}
            emptyTitle="No products in this filter"
            columns={[
              { key: "name", header: "Product", sortValue: (r) => r.name, cell: (r) => <Link href={`/products/${r.id}`} className="font-medium hover:text-primary hover:underline">{r.name}</Link> },
              { key: "kind", header: "Type", cell: (r) => <StatusBadge status={r.kind} /> },
              { key: "stock", header: "Current Stock", align: "right", sortValue: (r) => r.stock, cell: (r) => <span className="num font-semibold">{qty(r.stock)} <span className="text-xs font-normal text-muted-foreground">{r.unit}</span></span> },
              { key: "min", header: "Min Stock", align: "right", cell: (r) => <span className="num text-muted-foreground">{qty(r.minStock)}</span> },
              {
                key: "level",
                header: "Level",
                cell: (r) => {
                  const pct = Math.min(100, (r.stock / Math.max(1, r.minStock * 3)) * 100)
                  return (
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                      <div className={r.st === "in" ? "h-full bg-success" : r.st === "low" ? "h-full bg-warning" : "h-full bg-destructive"} style={{ width: `${Math.max(2, pct)}%` }} />
                    </div>
                  )
                },
              },
              { key: "cost", header: "Cost Price", align: "right", cell: (r) => <span className="num">{npr(r.purchasePrice)}</span> },
              { key: "value", header: "Stock Value", align: "right", sortValue: (r) => r.value, cell: (r) => <span className="num font-medium">{npr(r.value)}</span> },
              { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.st} /> },
              {
                key: "act",
                header: "",
                align: "right",
                cell: (r) => (
                  <Button variant="ghost" size="xs" onClick={() => openDialog({ kind: "stock", mode: "adjust", productId: r.id })}>
                    Adjust
                  </Button>
                ),
              },
            ]}
          />
        </TabsContent>

        <TabsContent value="moves">
          <FilterBar>
            <div className="w-full sm:w-72"><ProductPicker value={mvProduct} onChange={setMvProduct} placeholder="All products" /></div>
            {mvProduct && <Button variant="ghost" size="sm" onClick={() => setMvProduct(null)}>Clear product</Button>}
            <SimpleSelect
              value={mvType}
              onChange={setMvType}
              className="sm:w-48"
              options={[
                { value: "all", label: "All transactions" },
                { value: "purchase", label: "Purchase" },
                { value: "sale", label: "Sales" },
                { value: "production", label: "Production" },
                { value: "adjustment", label: "Adjustments" },
                { value: "manual", label: "Manual In / Out" },
                { value: "opening", label: "Opening Stock" },
              ]}
            />
            <DateRangeFilter value={range} onChange={setRange} />
          </FilterBar>
          <DataTable
            rows={movementRows}
            getRowId={(r) => r.id}
            pageSize={20}
            emptyTitle="No stock movement"
            emptyDescription="Try a wider date range or another product."
            columns={[
              { key: "date", header: "Date", cell: (r) => fmtDate(r.date) },
              { key: "product", header: "Product", cell: (r) => <Link href={`/products/${r.productId}`} className="block max-w-64 truncate hover:underline">{productMap[r.productId]?.name}</Link> },
              { key: "type", header: "Transaction", cell: (r) => <StatusBadge label={MOVE_LABEL[r.type]} tone={r.type.startsWith("adjustment") ? "amber" : r.qty > 0 ? "green" : "red"} /> },
              { key: "in", header: "In", align: "right", cell: (r) => (r.qty > 0 ? <span className="num text-success">+{qty(r.qty)}</span> : "") },
              { key: "out", header: "Out", align: "right", cell: (r) => (r.qty < 0 ? <span className="num text-destructive">−{qty(-r.qty)}</span> : "") },
              { key: "bal", header: "Balance", align: "right", cell: (r) => <span className="num font-semibold">{qty(r.balance)} <span className="text-xs font-normal text-muted-foreground">{productMap[r.productId]?.unit}</span></span> },
              { key: "ref", header: "Reference", cell: (r) => <span className="font-medium">{r.reference}</span> },
              { key: "note", header: "Note", cell: (r) => <span className="block max-w-48 truncate text-xs text-muted-foreground">{r.note ?? ""}</span> },
            ]}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
