"use client"

import { useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { FileText, Package, Truck, Users, Wallet } from "lucide-react"
import { fmtDate, npr } from "@/lib/format"
import { NAV } from "@/lib/nav"
import { useStore } from "@/lib/store"
import { useUI } from "@/lib/ui-store"
import { usePartyMap } from "@/lib/hooks"
import { CommandDialog, Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"

export function GlobalSearch() {
  const router = useRouter()
  const open = useUI((s) => s.searchOpen)
  const setOpen = useUI((s) => s.setSearchOpen)
  const parties = useStore((s) => s.parties)
  const products = useStore((s) => s.products)
  const invoices = useStore((s) => s.invoices)
  const purchases = useStore((s) => s.purchases)
  const payments = useStore((s) => s.payments)
  const partyMap = usePartyMap()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen(!useUI.getState().searchOpen)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [setOpen])

  const recentInvoices = useMemo(() => [...invoices].reverse(), [invoices])
  const recentPurchases = useMemo(() => [...purchases].reverse(), [purchases])
  const recentPayments = useMemo(() => [...payments].sort((a, b) => b.date.localeCompare(a.date)), [payments])

  const go = (href: string) => {
    setOpen(false)
    router.push(href)
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Search" description="Search parties, products, invoices, purchases and payments" className="sm:max-w-xl">
      <Command>
        <CommandInput placeholder="Type a name, phone, SKU, invoice no…" />
        <CommandList className="max-h-[60vh]">
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Go to">
            {NAV.map((n) => (
              <CommandItem key={n.href} value={`page ${n.label} ${n.np ?? ""}`} onSelect={() => go(n.href)}>
                <n.icon /> {n.label}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Parties">
            {parties.map((p) => (
              <CommandItem key={p.id} value={`party ${p.name} ${p.phone} ${p.address} ${p.pan ?? ""}`} onSelect={() => go(`/parties/${p.id}`)}>
                <Users />
                <span className="flex-1 truncate">{p.name}</span>
                <span className="text-xs text-muted-foreground">{p.phone}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Products">
            {products.map((p) => (
              <CommandItem key={p.id} value={`product ${p.name} ${p.sku} ${p.barcode} ${p.category}`} onSelect={() => go(`/products/${p.id}`)}>
                <Package />
                <span className="flex-1 truncate">{p.name}</span>
                <span className="text-xs text-muted-foreground">{p.sku}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Invoices">
            {recentInvoices.map((i) => (
              <CommandItem key={i.id} value={`invoice ${i.number} ${i.customerName}`} onSelect={() => go(`/invoices/${i.id}`)}>
                <FileText />
                <span className="w-20 font-medium">{i.number}</span>
                <span className="flex-1 truncate text-muted-foreground">{i.customerName}</span>
                <span className="num text-xs">{npr(i.total)}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Purchases">
            {recentPurchases.map((p) => (
              <CommandItem key={p.id} value={`purchase ${p.number} ${p.supplierBillNo} ${partyMap[p.partyId]?.name ?? ""}`} onSelect={() => go(`/purchases/${p.id}`)}>
                <Truck />
                <span className="w-20 font-medium">{p.number}</span>
                <span className="flex-1 truncate text-muted-foreground">{partyMap[p.partyId]?.name}</span>
                <span className="num text-xs">{npr(p.total)}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Payments / Transactions">
            {recentPayments.map((p) => (
              <CommandItem key={p.id} value={`payment transaction ${p.number} ${p.reference ?? ""} ${p.partyId ? partyMap[p.partyId]?.name ?? "" : "cash sale"}`} onSelect={() => go(`/payments?tab=${p.direction}&q=${p.number}`)}>
                <Wallet />
                <span className="w-20 font-medium">{p.number}</span>
                <span className="flex-1 truncate text-muted-foreground">
                  {p.direction === "in" ? "Received from" : "Paid to"} {p.partyId ? partyMap[p.partyId]?.name : "Walk-in"} · {fmtDate(p.date)}
                </span>
                <span className="num text-xs">{npr(p.amount)}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
