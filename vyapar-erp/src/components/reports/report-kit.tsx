"use client"

import { Download, Printer } from "lucide-react"
import { downloadCSV, fmtDate } from "@/lib/format"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { DateRangeFilter, SearchInput, type DateRange } from "@/components/shared/filters"

export interface RCol<T> {
  header: string
  align?: "left" | "right" | "center"
  cell: (r: T) => React.ReactNode
  /** Plain value used for CSV export */
  value: (r: T) => string | number
  total?: React.ReactNode
  className?: string
}

export function exportReport<T>(name: string, cols: RCol<T>[], rows: T[]) {
  downloadCSV(name, [cols.map((c) => c.header), ...rows.map((r) => cols.map((c) => c.value(r)))])
}

/** Frame shared by every report: filters, search, date range, export & print. */
export function ReportFrame({
  title,
  description,
  range,
  onRange,
  search,
  onSearch,
  searchPlaceholder,
  filters,
  onExport,
  children,
}: {
  title: string
  description?: string
  range?: DateRange
  onRange?: (r: DateRange) => void
  search?: string
  onSearch?: (v: string) => void
  searchPlaceholder?: string
  filters?: React.ReactNode
  onExport?: () => void
  children: React.ReactNode
}) {
  const business = useStore((s) => s.business)
  return (
    <div className="min-w-0">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between print:hidden">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        <div className="flex gap-2">
          {onExport && (
            <Button variant="outline" className="h-9" onClick={onExport}>
              <Download /> Export
            </Button>
          )}
          <Button variant="outline" className="h-9" onClick={() => window.print()}>
            <Printer /> Print
          </Button>
        </div>
      </div>
      <div className="mb-4 flex flex-col gap-2 rounded-lg border bg-card p-3 shadow-xs sm:flex-row sm:flex-wrap sm:items-center print:hidden">
        {onSearch && <SearchInput value={search ?? ""} onChange={onSearch} placeholder={searchPlaceholder} />}
        {range && onRange && <DateRangeFilter value={range} onChange={onRange} />}
        {filters}
      </div>
      <div className="print-area space-y-4">
        <div className="hidden border-b-2 border-slate-800 pb-2 print:block">
          <div className="text-lg font-bold">{business.name}</div>
          <div className="text-sm">{business.address} · PAN {business.pan}</div>
          <div className="mt-1 text-base font-semibold">{title}</div>
          {range && range.preset !== "all" && <div className="text-sm">Period: {fmtDate(range.from)} to {fmtDate(range.to)}</div>}
        </div>
        {children}
      </div>
    </div>
  )
}

export function SummaryGrid({ items }: { items: { label: string; value: React.ReactNode; tone?: "success" | "danger" | "primary" }[] }) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-4">
      {items.map((i) => (
        <div key={i.label} className="bg-card p-3">
          <div className="text-xs text-muted-foreground">{i.label}</div>
          <div className={cn("num mt-0.5 text-base font-semibold", i.tone === "success" && "text-success", i.tone === "danger" && "text-destructive", i.tone === "primary" && "text-primary")}>{i.value}</div>
        </div>
      ))}
    </div>
  )
}

export function ReportTable<T>({
  cols,
  rows,
  getKey,
  onRowClick,
  empty = "No data for the selected filters.",
  maxHeight = true,
}: {
  cols: RCol<T>[]
  rows: T[]
  getKey: (r: T, i: number) => string
  onRowClick?: (r: T) => void
  empty?: string
  maxHeight?: boolean
}) {
  const hasTotal = cols.some((c) => c.total !== undefined)
  const al = (a?: string) => (a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left")
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className={cn("overflow-auto", maxHeight && "max-h-[560px] print:max-h-none")}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-muted">
            <tr className="text-xs text-muted-foreground uppercase">
              {cols.map((c) => (
                <th key={c.header} className={cn("px-3 py-2 font-semibold whitespace-nowrap", al(c.align))}>{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={cols.length} className="px-3 py-10 text-center text-muted-foreground">{empty}</td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={getKey(r, i)} className={cn("border-t hover:bg-muted/40", onRowClick && "cursor-pointer")} onClick={onRowClick ? () => onRowClick(r) : undefined}>
                {cols.map((c) => (
                  <td key={c.header} className={cn("px-3 py-2 whitespace-nowrap", al(c.align), c.className)}>{c.cell(r)}</td>
                ))}
              </tr>
            ))}
          </tbody>
          {hasTotal && rows.length > 0 && (
            <tfoot className="sticky bottom-0 bg-muted font-semibold">
              <tr className="border-t-2">
                {cols.map((c, i) => (
                  <td key={c.header} className={cn("num px-3 py-2 whitespace-nowrap", al(c.align))}>{c.total ?? (i === 0 ? "Total" : "")}</td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
