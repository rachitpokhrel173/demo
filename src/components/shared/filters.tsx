"use client"

import { format, startOfMonth, startOfWeek, subDays, subMonths, endOfMonth } from "date-fns"
import { Search, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <div className={cn("relative w-full sm:w-64", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-9 bg-card pr-8 pl-8" />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted"
          aria-label="Clear search"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}

export interface Option {
  value: string
  label: React.ReactNode
}

export function SimpleSelect({
  value,
  onChange,
  options,
  placeholder = "Select…",
  className,
  size = "default",
  disabled,
  id,
}: {
  value: string
  onChange: (v: string) => void
  options: Option[]
  placeholder?: string
  className?: string
  size?: "sm" | "default"
  disabled?: boolean
  id?: string
}) {
  return (
    <Select
      value={value || null}
      onValueChange={(v) => onChange((v as string) ?? "")}
      items={options.map((o) => ({ value: o.value, label: o.label }))}
      disabled={disabled}
    >
      <SelectTrigger id={id} size={size} className={cn("h-9 w-full min-w-0 bg-card data-[size=sm]:h-8 [&>[data-slot=select-value]]:truncate", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export type RangePreset = "today" | "week" | "month" | "last_month" | "30d" | "90d" | "all" | "custom"

export interface DateRange {
  preset: RangePreset
  from: string
  to: string
}

const f = (d: Date) => format(d, "yyyy-MM-dd")

export function rangeFor(preset: RangePreset, custom?: { from: string; to: string }): DateRange {
  const now = new Date()
  switch (preset) {
    case "today":
      return { preset, from: f(now), to: f(now) }
    case "week":
      return { preset, from: f(startOfWeek(now, { weekStartsOn: 0 })), to: f(now) }
    case "month":
      return { preset, from: f(startOfMonth(now)), to: f(now) }
    case "last_month": {
      const lm = subMonths(now, 1)
      return { preset, from: f(startOfMonth(lm)), to: f(endOfMonth(lm)) }
    }
    case "30d":
      return { preset, from: f(subDays(now, 29)), to: f(now) }
    case "90d":
      return { preset, from: f(subDays(now, 89)), to: f(now) }
    case "all":
      return { preset, from: "2000-01-01", to: "2999-12-31" }
    case "custom":
      return { preset, from: custom?.from ?? f(subDays(now, 29)), to: custom?.to ?? f(now) }
  }
}

export const inRange = (date: string, r: DateRange) => date >= r.from && date <= r.to

const PRESETS: Option[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "30d", label: "Last 30 Days" },
  { value: "90d", label: "Last 90 Days" },
  { value: "all", label: "All Time" },
  { value: "custom", label: "Custom Range" },
]

export function DateRangeFilter({ value, onChange, className }: { value: DateRange; onChange: (r: DateRange) => void; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <SimpleSelect
        value={value.preset}
        onChange={(p) => onChange(rangeFor(p as RangePreset, value))}
        options={PRESETS}
        className="w-full sm:w-40"
      />
      {value.preset === "custom" && (
        <div className="flex items-center gap-1.5">
          <Input type="date" value={value.from} max={value.to} onChange={(e) => onChange({ ...value, from: e.target.value })} className="h-9 w-[9.5rem] bg-card" aria-label="From date" />
          <span className="text-xs text-muted-foreground">to</span>
          <Input type="date" value={value.to} min={value.from} onChange={(e) => onChange({ ...value, to: e.target.value })} className="h-9 w-[9.5rem] bg-card" aria-label="To date" />
        </div>
      )}
    </div>
  )
}

export function FilterBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center print:hidden", className)}>{children}</div>
}

/** Pill-style segmented tabs for quick filters (e.g. All / Paid / Due) */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; count?: number }[]
  className?: string
}) {
  return (
    <div className={cn("inline-flex max-w-full overflow-x-auto rounded-lg border bg-card p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground",
            value === o.value && "bg-primary text-primary-foreground hover:text-primary-foreground",
          )}
        >
          {o.label}
          {o.count !== undefined && (
            <span className={cn("rounded px-1 text-[10px]", value === o.value ? "bg-white/20" : "bg-muted")}>{o.count}</span>
          )}
        </button>
      ))}
    </div>
  )
}
