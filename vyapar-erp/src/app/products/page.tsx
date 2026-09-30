"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Download, Eye, MoreHorizontal, PackagePlus, Pencil, SlidersHorizontal, Trash2 } from "lucide-react"
import { downloadCSV, npr, qty } from "@/lib/format"
import { stockStatus } from "@/lib/ledger"
import { useStockMap } from "@/lib/hooks"
import { useStore } from "@/lib/store"
import { confirmAction, useUI } from "@/lib/ui-store"
import type { Product } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { DataTable, type Column } from "@/components/shared/data-table"
import { FilterBar, SearchInput, SimpleSelect } from "@/components/shared/filters"
import { PageHeader } from "@/components/shared/ui-bits"
import { StatusBadge } from "@/components/shared/status-badge"

type Row = Product & { stock: number; st: "in" | "low" | "out" }

export default function ProductsPage() {
  const router = useRouter()
  const products = useStore((s) => s.products)
  const categories = useStore((s) => s.categories)
  const deleteProduct = useStore((s) => s.deleteProduct)
  const openDialog = useUI((s) => s.openDialog)
  const stock = useStockMap()
  const [q, setQ] = useState("")
  const [cat, setCat] = useState("all")
  const [kind, setKind] = useState("all")
  const [st, setSt] = useState("all")

  const rows: Row[] = useMemo(() => products.map((p) => ({ ...p, stock: stock[p.id] ?? 0, st: stockStatus(p, stock[p.id] ?? 0) })), [products, stock])
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return rows.filter(
      (r) =>
        (cat === "all" || r.category === cat) &&
        (kind === "all" || r.kind === kind) &&
        (st === "all" || r.st === st) &&
        (!s || r.name.toLowerCase().includes(s) || r.sku.toLowerCase().includes(s) || r.barcode.includes(s)),
    )
  }, [rows, q, cat, kind, st])

  const remove = async (p: Product) => {
    const ok = await confirmAction({ title: `Delete ${p.name}?`, description: "The product will be removed permanently.", confirmText: "Delete", destructive: true })
    if (!ok) return
    const r = deleteProduct(p.id)
    if (r.ok) toast.success("Product deleted")
    else toast.error("Cannot delete product", { description: r.error })
  }

  const columns: Column<Row>[] = [
    {
      key: "name",
      header: "Product",
      sortValue: (r) => r.name,
      cell: (r) => (
        <div className="min-w-0">
          <div className="max-w-72 truncate font-medium">{r.name}</div>
          <div className="text-xs text-muted-foreground">{r.sku} · {r.barcode}</div>
        </div>
      ),
    },
    { key: "category", header: "Category", cell: (r) => <span className="text-muted-foreground">{r.category}</span>, sortValue: (r) => r.category },
    { key: "kind", header: "Type", cell: (r) => <StatusBadge status={r.kind} /> },
    { key: "unit", header: "Unit", cell: (r) => r.unit },
    { key: "pp", header: "Purchase Price", align: "right", sortValue: (r) => r.purchasePrice, cell: (r) => <span className="num">{npr(r.purchasePrice)}</span> },
    { key: "sp", header: "Selling Price", align: "right", sortValue: (r) => r.sellingPrice, cell: (r) => <span className="num">{r.sellingPrice ? npr(r.sellingPrice) : "—"}</span> },
    { key: "stock", header: "Current Stock", align: "right", sortValue: (r) => r.stock, cell: (r) => <span className="num font-semibold">{qty(r.stock)} <span className="text-xs font-normal text-muted-foreground">{r.unit}</span></span> },
    { key: "min", header: "Min", align: "right", cell: (r) => <span className="num text-muted-foreground">{qty(r.minStock)}</span> },
    { key: "vat", header: "VAT", align: "center", cell: (r) => `${r.vatRate}%` },
    { key: "status", header: "Status", cell: (r) => (r.status === "inactive" ? <StatusBadge status="inactive" /> : <StatusBadge status={r.st} />) },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (r) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Actions" />}>
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => router.push(`/products/${r.id}`)}><Eye /> View</DropdownMenuItem>
              <DropdownMenuItem onClick={() => openDialog({ kind: "product", product: r })}><Pencil /> Edit</DropdownMenuItem>
              <DropdownMenuItem onClick={() => openDialog({ kind: "stock", mode: "adjust", productId: r.id })}><SlidersHorizontal /> Adjust Stock</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => remove(r)}><Trash2 /> Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Products"
        description={`${products.length} products · raw materials, finished goods and trading items`}
        actions={
          <>
            <Button variant="outline" className="h-9" onClick={() => downloadCSV("products", [["Name", "SKU", "Barcode", "Category", "Unit", "Type", "Purchase Price", "Selling Price", "Stock", "Min Stock", "VAT"], ...filtered.map((r) => [r.name, r.sku, r.barcode, r.category, r.unit, r.kind, r.purchasePrice, r.sellingPrice, r.stock, r.minStock, r.vatRate])])}>
              <Download /> Export
            </Button>
            <Button className="h-9" onClick={() => openDialog({ kind: "product" })}><PackagePlus /> Add Product</Button>
          </>
        }
      />
      <FilterBar>
        <SearchInput value={q} onChange={setQ} placeholder="Search name, SKU or barcode" className="sm:w-72" />
        <SimpleSelect value={cat} onChange={setCat} className="sm:w-48" options={[{ value: "all", label: "All categories" }, ...categories.map((c) => ({ value: c, label: c }))]} />
        <SimpleSelect value={kind} onChange={setKind} className="sm:w-44" options={[{ value: "all", label: "All types" }, { value: "raw", label: "Raw Material" }, { value: "finished", label: "Finished Good" }, { value: "trading", label: "Trading Item" }]} />
        <SimpleSelect value={st} onChange={setSt} className="sm:w-40" options={[{ value: "all", label: "Any stock" }, { value: "in", label: "In Stock" }, { value: "low", label: "Low Stock" }, { value: "out", label: "Out of Stock" }]} />
      </FilterBar>
      <DataTable
        rows={filtered}
        columns={columns}
        getRowId={(r) => r.id}
        onRowClick={(r) => router.push(`/products/${r.id}`)}
        emptyTitle="No products found"
        emptyAction={<Button onClick={() => openDialog({ kind: "product" })}><PackagePlus /> Add Product</Button>}
        mobileCard={(r) => (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{r.name}</div>
              <div className="text-xs text-muted-foreground">{r.sku} · {npr(r.sellingPrice || r.purchasePrice)}</div>
            </div>
            <div className="text-right">
              <div className="num text-sm font-semibold">{qty(r.stock)} {r.unit}</div>
              <StatusBadge status={r.st} className="mt-1" />
            </div>
          </div>
        )}
      />
    </div>
  )
}
