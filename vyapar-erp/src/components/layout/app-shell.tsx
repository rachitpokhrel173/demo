"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Toaster } from "sonner"
import { cn } from "@/lib/utils"
import { NAV } from "@/lib/nav"
import { STORAGE_KEY, useStore } from "@/lib/store"
import { useUI } from "@/lib/ui-store"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { ConfirmHost } from "@/components/shared/form-dialog"
import { GlobalDialogs } from "@/components/dialogs/global-dialogs"
import { Header } from "./header"
import { GlobalSearch } from "./global-search"

export function AppShell({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Load demo data from localStorage (or seed it the first time)
    try {
      ;["abc-erp-demo-v1", "abc-erp-demo-v2", "abc-erp-demo-v3", "abc-erp-demo-v4", "abc-erp-demo-v5"].forEach((k) => localStorage.removeItem(k))
    } catch {}
    Promise.resolve(useStore.persist.rehydrate()).then(() => {
      const s = useStore.getState()
      if (!s.seeded) s.resetDemo()
      else s.rebaseDates()
      setReady(true)
    })
    // Keep several open tabs in sync: reload data when another tab saves
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) useStore.persist.rehydrate()
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  return (
    <TooltipProvider>
      <div className="flex min-h-screen bg-background">
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 lg:block print:hidden">
          <SidebarContent />
        </aside>
        <MobileNav />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header ready={ready} />
          <main className="mx-auto w-full max-w-[1500px] flex-1 px-4 py-5 sm:px-6 lg:px-8 print:p-0">
            {ready ? children : <LoadingSkeleton />}
          </main>
        </div>
      </div>
      {ready && (
        <>
          <GlobalDialogs />
          <GlobalSearch />
        </>
      )}
      <ConfirmHost />
      <Toaster position="bottom-right" richColors closeButton toastOptions={{ duration: 4000 }} />
    </TooltipProvider>
  )
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const business = useStore((s) => s.business)
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href))
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <Link href="/" onClick={onNavigate} className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-4">
        <div className="flex size-8 items-center justify-center rounded-md bg-sidebar-primary text-xs font-bold text-white">
          {business.logoText || "ABC"}
        </div>
        <div className="min-w-0 leading-tight">
          <div className="truncate text-sm font-semibold text-white">Byapar ERP</div>
          <div className="truncate text-[11px] text-sidebar-foreground/70">Stock · Billing · Manufacturing</div>
        </div>
      </Link>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
        {NAV.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "group flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium transition-colors",
                active ? "bg-sidebar-primary text-white" : "hover:bg-sidebar-accent hover:text-white",
              )}
            >
              <item.icon className={cn("size-4 shrink-0", active ? "text-white" : "text-sidebar-foreground/70 group-hover:text-white")} />
              <span className="flex-1 truncate">{item.label}</span>
              {item.np && <span className={cn("text-[11px]", active ? "text-white/70" : "text-sidebar-foreground/45")}>{item.np}</span>}
            </Link>
          )
        })}
      </nav>
      <div className="border-t border-sidebar-border p-3 text-[11px] text-sidebar-foreground/60">
        <div className="rounded-md bg-sidebar-accent px-3 py-2">
          <div className="font-medium text-sidebar-foreground">Demo Mode</div>
          <div>Data is saved in this browser only.</div>
        </div>
      </div>
    </div>
  )
}

function MobileNav() {
  const open = useUI((s) => s.mobileNav)
  const setOpen = useUI((s) => s.setMobileNav)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="left" className="w-64 border-0 p-0 data-[side=left]:w-64" showCloseButton={false}>
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SidebarContent onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Skeleton className="h-72 rounded-lg xl:col-span-2" />
        <Skeleton className="h-72 rounded-lg" />
      </div>
    </div>
  )
}
