"use client"

import { useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { differenceInDays, parseISO } from "date-fns"
import { AlertTriangle, Bell, Building2, ChevronDown, Factory, LogOut, Menu, Plus, RotateCcw, Search, Settings, UserRound, Wallet } from "lucide-react"
import { cn } from "@/lib/utils"
import { QUICK_ACTIONS } from "@/lib/nav"
import { npr, qty } from "@/lib/format"
import { useInvoicePaid, usePartySummaries, useStockMap } from "@/lib/hooks"
import { useStore } from "@/lib/store"
import { confirmAction, useUI } from "@/lib/ui-store"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function Header({ ready }: { ready: boolean }) {
  const router = useRouter()
  const setMobileNav = useUI((s) => s.setMobileNav)
  const setSearchOpen = useUI((s) => s.setSearchOpen)
  const openDialog = useUI((s) => s.openDialog)
  const business = useStore((s) => s.business)
  const users = useStore((s) => s.users)
  const admin = users[0]

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card/95 px-3 backdrop-blur sm:px-6 lg:px-8 print:hidden">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileNav(true)} aria-label="Open menu">
        <Menu />
      </Button>

      <button
        type="button"
        onClick={() => setSearchOpen(true)}
        className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border bg-background px-3 text-sm text-muted-foreground transition-colors hover:border-primary/40 md:max-w-md"
      >
        <Search className="size-4 shrink-0" />
        <span className="truncate">Search parties, products, invoices…</span>
        <kbd className="ml-auto hidden rounded border bg-card px-1.5 font-mono text-[10px] sm:inline">Ctrl K</kbd>
      </button>

      <div className="ml-auto flex items-center gap-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button className="h-9 gap-1.5 px-3" />}>
            <Plus />
            <span className="hidden sm:inline">Quick Add</span>
            <ChevronDown className="hidden size-3.5 opacity-70 sm:block" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Quick Add</DropdownMenuLabel>
              {QUICK_ACTIONS.map((a) => (
                <DropdownMenuItem
                  key={a.label}
                  onClick={() => (a.href ? router.push(a.href) : a.dialog && openDialog(a.dialog))}
                >
                  <a.icon /> {a.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {ready && <Notifications />}

        <div className="mx-1 hidden h-8 w-px bg-border xl:block" />
        <div className="hidden items-center gap-2 xl:flex">
          <Building2 className="size-4 text-muted-foreground" />
          <div className="max-w-56 truncate text-sm font-medium">{business.name}</div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" className="h-9 gap-2 px-1.5" aria-label="User menu" />}>
            <div className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {admin?.name?.split(" ").map((n) => n[0]).join("") ?? "AD"}
            </div>
            <div className="hidden text-left leading-tight md:block">
              <div className="text-xs font-medium">{admin?.name ?? "Admin"}</div>
              <div className="text-[10px] text-muted-foreground">{admin?.role ?? "Admin"}</div>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <div className="font-medium text-foreground">{admin?.name}</div>
                <div className="font-normal">{admin?.email}</div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/settings")}><UserRound /> My Profile</DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/settings")}><Settings /> Settings</DropdownMenuItem>
            <DropdownMenuItem
              onClick={async () => {
                const ok = await confirmAction({ title: "Reset demo data?", description: "All changes you made in this demo will be replaced with fresh sample data.", confirmText: "Reset Data", destructive: true })
                if (ok) {
                  useStore.getState().resetDemo()
                  toast.success("Demo data has been reset")
                  router.push("/")
                }
              }}
            >
              <RotateCcw /> Reset Demo Data
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => toast.info("Logout is disabled in demo mode")}><LogOut /> Log out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

function Notifications() {
  const products = useStore((s) => s.products)
  const parties = useStore((s) => s.parties)
  const invoices = useStore((s) => s.invoices)
  const productions = useStore((s) => s.productions)
  const stock = useStockMap()
  const summaries = usePartySummaries()
  const paid = useInvoicePaid()
  const read = useUI((s) => s.readNotifications)
  const markRead = useUI((s) => s.markRead)

  const items = useMemo(() => {
    const list: { id: string; icon: typeof Bell; tone: string; title: string; body: string; href: string }[] = []
    for (const p of products) {
      const q = stock[p.id] ?? 0
      if (p.status === "active" && q <= p.minStock)
        list.push({ id: `stock-${p.id}-${q}`, icon: AlertTriangle, tone: q <= 0 ? "text-destructive bg-destructive/10" : "text-warning bg-warning/10", title: q <= 0 ? "Out of stock" : "Low stock", body: `${p.name} — ${qty(q)} ${p.unit} left (min ${p.minStock})`, href: `/products/${p.id}` })
    }
    for (const p of parties) {
      const b = summaries[p.id]?.balance ?? 0
      if (p.creditLimit > 0 && b > p.creditLimit)
        list.push({ id: `credit-${p.id}-${Math.round(b)}`, icon: Wallet, tone: "text-destructive bg-destructive/10", title: "Credit limit exceeded", body: `${p.name} owes ${npr(b)} (limit ${npr(p.creditLimit)})`, href: `/parties/${p.id}` })
    }
    const overdue = invoices.filter((i) => !i.cancelled && i.partyId && i.total - (paid[i.id] ?? 0) > 1 && differenceInDays(new Date(), parseISO(i.date)) > 45)
    if (overdue.length)
      list.push({ id: `overdue-${overdue.length}`, icon: Wallet, tone: "text-warning bg-warning/10", title: `${overdue.length} invoices overdue`, body: "Unpaid for more than 45 days — follow up for collection.", href: "/invoices?status=due" })
    for (const p of productions.filter((x) => x.status === "in_progress"))
      list.push({ id: `prd-${p.id}`, icon: Factory, tone: "text-primary bg-primary/10", title: "Production in progress", body: `${p.number} — ${p.qty} units awaiting completion`, href: "/manufacturing" })
    return list
  }, [products, parties, invoices, productions, stock, summaries, paid])

  const unread = items.filter((i) => !read.includes(i.id)).length

  return (
    <Popover>
      <PopoverTrigger render={<Button variant="ghost" size="icon" className="relative size-9" aria-label="Notifications" />}>
        <Bell />
        {unread > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
            {unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] max-w-[calc(100vw-1.5rem)] gap-0 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2.5">
          <div className="text-sm font-semibold">Notifications</div>
          {unread > 0 && (
            <button className="text-xs text-primary hover:underline" onClick={() => markRead(items.map((i) => i.id))}>
              Mark all as read
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">You&apos;re all caught up.</div>}
          {items.map((n) => (
            <Link
              key={n.id}
              href={n.href}
              onClick={() => markRead([n.id])}
              className={cn("flex gap-3 border-b px-3 py-2.5 last:border-0 hover:bg-muted/50", !read.includes(n.id) && "bg-primary/[0.03]")}
            >
              <div className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md", n.tone)}>
                <n.icon className="size-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[13px] font-medium">
                  {n.title}
                  {!read.includes(n.id) && <span className="size-1.5 rounded-full bg-primary" />}
                </div>
                <div className="text-xs text-muted-foreground">{n.body}</div>
              </div>
            </Link>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
