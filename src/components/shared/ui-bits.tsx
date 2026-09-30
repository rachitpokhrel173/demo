"use client"

// Small reusable building blocks used across every module.
import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { ArrowLeft, Inbox } from "lucide-react"
import { cn } from "@/lib/utils"
import { npr } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

export function PageHeader({
  title,
  description,
  actions,
  back,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  back?: string
  className?: string
}) {
  return (
    <div className={cn("mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between print:hidden", className)}>
      <div className="flex min-w-0 items-start gap-2">
        {back && (
          <Button variant="ghost" size="icon-sm" className="mt-0.5 shrink-0" render={<Link href={back} />} nativeButton={false} aria-label="Back">
            <ArrowLeft />
          </Button>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">{title}</h1>
          {description && <div className="mt-0.5 text-sm text-muted-foreground">{description}</div>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={cn("min-w-0 rounded-lg border bg-card shadow-xs", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <div>
            {title && <h2 className="text-sm font-semibold">{title}</h2>}
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  )
}

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = "default",
  href,
}: {
  label: string
  value: React.ReactNode
  icon?: LucideIcon
  hint?: React.ReactNode
  tone?: "default" | "success" | "warning" | "danger" | "primary"
  href?: string
}) {
  const toneCls = {
    default: "bg-muted text-muted-foreground",
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    danger: "bg-destructive/10 text-destructive",
  }[tone]
  const body = (
    <div className="flex h-full items-start justify-between gap-3 rounded-lg border bg-card p-4 shadow-xs transition-colors group-hover:border-primary/40">
      <div className="min-w-0">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <div className="num mt-1.5 truncate text-lg font-semibold tracking-tight sm:text-xl">{value}</div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </div>
      {Icon && (
        <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-md", toneCls)}>
          <Icon className="size-4.5" />
        </div>
      )}
    </div>
  )
  return href ? (
    <Link href={href} className="group block">
      {body}
    </Link>
  ) : (
    body
  )
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-4 py-12 text-center", className)}>
      <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-muted">
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <div className="text-sm font-medium">{title}</div>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/** Amount with colour coding. `kind="balance"` shows Dr/Cr style receivable/payable text. */
export function Money({
  value,
  kind = "plain",
  className,
}: {
  value: number
  kind?: "plain" | "balance" | "due"
  className?: string
}) {
  if (kind === "balance") {
    if (Math.abs(value) < 0.5) return <span className={cn("num text-muted-foreground", className)}>NPR 0</span>
    return (
      <span className={cn("num font-medium", value > 0 ? "text-success" : "text-destructive", className)}>
        {npr(Math.abs(value))}
        <span className="ml-1 text-[10px] font-semibold uppercase opacity-80">{value > 0 ? "To receive" : "To pay"}</span>
      </span>
    )
  }
  if (kind === "due") {
    return <span className={cn("num", value > 0.5 ? "font-medium text-destructive" : "text-muted-foreground", className)}>{npr(value)}</span>
  }
  return <span className={cn("num", className)}>{npr(value)}</span>
}

export function Field({
  label,
  required,
  hint,
  error,
  children,
  className,
  htmlFor,
}: {
  label: string
  required?: boolean
  hint?: React.ReactNode
  error?: string
  children: React.ReactNode
  className?: string
  htmlFor?: string
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-xs font-medium text-foreground/80">
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export function KeyValue({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate text-sm font-medium">{value || "—"}</div>
    </div>
  )
}
