"use client"

import { Plus, Trash2 } from "lucide-react"
import { npr, qty as fmtQty } from "@/lib/format"
import { useProductMap, useStockMap } from "@/lib/hooks"
import type { LineItem, Product } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ProductPicker } from "./pickers"

export type EditableLine = LineItem & { key: number }

/** Table-style line item editor (used by the purchase form). */
export function LineItemsEditor({
  lines,
  onChange,
  priceField = "purchasePrice",
  filter,
}: {
  lines: EditableLine[]
  onChange: (lines: EditableLine[]) => void
  priceField?: "purchasePrice" | "sellingPrice"
  filter?: (p: Product) => boolean
}) {
  const products = useProductMap()
  const stock = useStockMap()
  const patch = (key: number, p: Partial<EditableLine>) => onChange(lines.map((l) => (l.key === key ? { ...l, ...p } : l)))

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
            <tr>
              <th className="w-10 px-3 py-2 text-left font-semibold">#</th>
              <th className="min-w-[240px] px-3 py-2 text-left font-semibold">Product</th>
              <th className="w-36 px-3 py-2 text-right font-semibold">Qty</th>
              <th className="w-28 px-3 py-2 text-right font-semibold">Rate</th>
              <th className="w-24 px-3 py-2 text-right font-semibold">Discount</th>
              <th className="w-20 px-3 py-2 text-right font-semibold">VAT</th>
              <th className="w-32 px-3 py-2 text-right font-semibold">Amount</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const p = products[l.productId]
              const net = l.qty * l.rate - l.discount
              return (
                <tr key={l.key} className="border-t align-top">
                  <td className="px-3 py-3 text-muted-foreground">{i + 1}</td>
                  <td className="px-2 py-1.5">
                    <ProductPicker
                      value={l.productId || null}
                      filter={filter}
                      onChange={(id) => {
                        const np = products[id]
                        patch(l.key, { productId: id, name: np.name, unit: np.unit, rate: np[priceField], vatRate: np.vatRate })
                      }}
                    />
                    {p && (
                      <div className="mt-1 px-1 text-[11px] text-muted-foreground">
                        In stock: {fmtQty(stock[p.id] ?? 0)} {p.unit} · Last rate {npr(p.purchasePrice)}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="relative">
                      <Input type="number" min={0} step="any" value={l.qty || ""} placeholder="0" onChange={(e) => patch(l.key, { qty: Number(e.target.value) || 0 })} className="h-9 pr-11 text-right" />
                      <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[10px] text-muted-foreground">{p?.unit}</span>
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <Input type="number" min={0} step="any" value={l.rate || ""} placeholder="0" onChange={(e) => patch(l.key, { rate: Number(e.target.value) || 0 })} className="h-9 text-right" />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input type="number" min={0} step="any" value={l.discount || ""} placeholder="0" onChange={(e) => patch(l.key, { discount: Number(e.target.value) || 0 })} className="h-9 text-right" />
                  </td>
                  <td className="px-2 py-1.5">
                    <select
                      value={l.vatRate}
                      onChange={(e) => patch(l.key, { vatRate: Number(e.target.value) })}
                      className="h-9 w-full rounded-lg border border-input bg-transparent px-2 text-right text-sm"
                      aria-label="VAT rate"
                    >
                      <option value={13}>13%</option>
                      <option value={0}>0%</option>
                    </select>
                  </td>
                  <td className="num px-3 py-3 text-right font-medium">{npr(net)}</td>
                  <td className="px-1 py-1.5">
                    <Button type="button" variant="ghost" size="icon-sm" className="mt-1" disabled={lines.length === 1} onClick={() => onChange(lines.filter((x) => x.key !== l.key))} aria-label="Remove line">
                      <Trash2 />
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="border-t p-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange([...lines, blankLine()])}>
          <Plus /> Add another item
        </Button>
      </div>
    </div>
  )
}

let seq = 1
export function blankLine(): EditableLine {
  return { key: Date.now() + seq++, productId: "", name: "", unit: "PCS", qty: 0, rate: 0, discount: 0, vatRate: 13 }
}
