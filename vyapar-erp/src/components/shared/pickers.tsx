"use client"

import { useMemo, useState } from "react"
import { ChevronsUpDown, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { npr, qty as fmtQty } from "@/lib/format"
import { usePartySummaries, useStockMap } from "@/lib/hooks"
import { useStore } from "@/lib/store"
import { useUI } from "@/lib/ui-store"
import type { ID, PartyType, Product } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export interface ComboItem {
  value: string
  label: string
  sub?: string
  right?: React.ReactNode
  disabled?: boolean
}

export function Combobox({
  items,
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "Nothing found.",
  footer,
  className,
  id,
}: {
  items: ComboItem[]
  value: string | null
  onChange: (v: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  footer?: (close: () => void) => React.ReactNode
  className?: string
  id?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = items.find((i) => i.value === value)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            variant="outline"
            className={cn("h-9 w-full justify-between bg-card px-2.5 font-normal", !selected && "text-muted-foreground", className)}
          />
        }
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <ChevronsUpDown className="opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-(--anchor-width) min-w-80 p-0" align="start">
        <Command>
          <CommandInput autoFocus placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {items.map((it) => (
                <CommandItem
                  key={it.value}
                  value={`${it.label} ${it.sub ?? ""} ${it.value}`}
                  disabled={it.disabled}
                  data-checked={it.value === value}
                  onSelect={() => {
                    onChange(it.value)
                    setOpen(false)
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{it.label}</div>
                    {it.sub && <div className="truncate text-xs text-muted-foreground">{it.sub}</div>}
                  </div>
                  {it.right && <div className="shrink-0 text-xs text-muted-foreground">{it.right}</div>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          {footer && <div className="border-t p-1">{footer(() => setOpen(false))}</div>}
        </Command>
      </PopoverContent>
    </Popover>
  )
}

/** Party picker filtered to customers or suppliers, showing the current balance. */
export function PartyPicker({
  value,
  onChange,
  role,
  placeholder,
  allowWalkIn,
  id,
}: {
  value: ID | null
  onChange: (id: ID | null) => void
  role: "customer" | "supplier" | "any"
  placeholder?: string
  allowWalkIn?: boolean
  id?: string
}) {
  const parties = useStore((s) => s.parties)
  const summaries = usePartySummaries()
  const openDialog = useUI((s) => s.openDialog)
  const items = useMemo<ComboItem[]>(() => {
    const ok = (t: PartyType) => role === "any" || t === role || t === "both"
    const list: ComboItem[] = parties
      .filter((p) => p.status === "active" && ok(p.type))
      .map((p) => {
        const b = summaries[p.id]?.balance ?? 0
        return {
          value: p.id,
          label: p.name,
          sub: `${p.phone} · ${p.address}`,
          right: Math.abs(b) > 0.5 ? <span className={b > 0 ? "text-success" : "text-destructive"}>{npr(Math.abs(b))}</span> : null,
        }
      })
    return allowWalkIn ? [{ value: "__walkin", label: "Cash Sale (Walk-in Customer)", sub: "No party ledger" }, ...list] : list
  }, [parties, summaries, role, allowWalkIn])

  return (
    <Combobox
      id={id}
      items={items}
      value={value ?? (allowWalkIn ? "__walkin" : null)}
      onChange={(v) => onChange(v === "__walkin" ? null : v)}
      placeholder={placeholder ?? (role === "supplier" ? "Select supplier" : "Select customer")}
      searchPlaceholder="Search by name, phone or address…"
      emptyText="No party found."
      footer={(close) => (
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={() => {
            close()
            openDialog({ kind: "party", defaultType: role === "supplier" ? "supplier" : "customer" })
          }}
        >
          <Plus /> Add new party
        </Button>
      )}
    />
  )
}

export function ProductPicker({
  value,
  onChange,
  filter,
  placeholder = "Select product",
  id,
}: {
  value: ID | null
  onChange: (id: ID) => void
  filter?: (p: Product) => boolean
  placeholder?: string
  id?: string
}) {
  const products = useStore((s) => s.products)
  const stock = useStockMap()
  const items = useMemo<ComboItem[]>(
    () =>
      products
        .filter((p) => p.status === "active" && (!filter || filter(p)))
        .map((p) => ({
          value: p.id,
          label: p.name,
          sub: `${p.sku} · ${p.category}`,
          right: `${fmtQty(stock[p.id] ?? 0)} ${p.unit}`,
        })),
    [products, stock, filter],
  )
  return <Combobox id={id} items={items} value={value} onChange={onChange} placeholder={placeholder} searchPlaceholder="Search product, SKU…" emptyText="No product found." />
}
