"use client"

import { useMemo, useState } from "react"
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { EmptyState } from "./ui-bits"

export interface Column<T> {
  key: string
  header: React.ReactNode
  cell: (row: T) => React.ReactNode
  align?: "left" | "right" | "center"
  /** Enables sorting on this column */
  sortValue?: (row: T) => string | number
  className?: string
  headClassName?: string
}

export interface DataTableProps<T> {
  rows: T[]
  columns: Column<T>[]
  getRowId: (row: T) => string
  onRowClick?: (row: T) => void
  pageSize?: number
  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: React.ReactNode
  footer?: React.ReactNode
  initialSort?: { key: string; dir: "asc" | "desc" }
  /** Card layout rendered instead of the table on small screens */
  mobileCard?: (row: T) => React.ReactNode
  className?: string
  rowClassName?: (row: T) => string | undefined
}

export function DataTable<T>({
  rows,
  columns,
  getRowId,
  onRowClick,
  pageSize = 15,
  emptyTitle = "No records found",
  emptyDescription = "Try changing the search or filters.",
  emptyAction,
  footer,
  initialSort,
  mobileCard,
  className,
  rowClassName,
}: DataTableProps<T>) {
  const [sort, setSort] = useState(initialSort)
  const [page, setPage] = useState(0)

  const sorted = useMemo(() => {
    const col = sort && columns.find((c) => c.key === sort.key)
    if (!col?.sortValue) return rows
    const f = col.sortValue
    const dir = sort!.dir === "asc" ? 1 : -1
    return [...rows].sort((a, b) => {
      const va = f(a)
      const vb = f(b)
      return (typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb))) * dir
    })
  }, [rows, sort, columns])

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize))
  // jump back to the first page whenever the result set changes (search / filter)
  const [prevLen, setPrevLen] = useState(rows.length)
  if (prevLen !== rows.length) {
    setPrevLen(rows.length)
    setPage(0)
  }
  const current = Math.min(page, pages - 1)
  const visible = sorted.slice(current * pageSize, current * pageSize + pageSize)

  const toggleSort = (key: string) =>
    setSort((s) => (s?.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }))

  const alignCls = (a?: string) => (a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left")

  if (!rows.length) {
    return (
      <div className={cn("rounded-lg border bg-card", className)}>
        <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
      </div>
    )
  }

  return (
    <div className={cn("overflow-hidden rounded-lg border bg-card shadow-xs", className)}>
      {mobileCard && (
        <ul className="divide-y md:hidden">
          {visible.map((r) => (
            <li
              key={getRowId(r)}
              className={cn("px-4 py-3", onRowClick && "cursor-pointer active:bg-muted/60")}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
            >
              {mobileCard(r)}
            </li>
          ))}
        </ul>
      )}
      <div className={cn("overflow-x-auto", mobileCard && "hidden md:block")}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    "h-9 px-3 text-xs font-semibold whitespace-nowrap text-muted-foreground uppercase tracking-wide",
                    alignCls(c.align),
                    c.headClassName,
                  )}
                >
                  {c.sortValue ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(c.key)}
                      className={cn("inline-flex items-center gap-1 uppercase hover:text-foreground", c.align === "right" && "flex-row-reverse")}
                    >
                      {c.header}
                      {sort?.key === c.key ? (
                        sort.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
                      ) : (
                        <ChevronsUpDown className="size-3 opacity-40" />
                      )}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr
                key={getRowId(r)}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                className={cn(
                  "border-b last:border-0 hover:bg-muted/40",
                  onRowClick && "cursor-pointer",
                  rowClassName?.(r),
                )}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cn("h-11 px-3 py-2 whitespace-nowrap", alignCls(c.align), c.className)}>
                    {c.cell(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {footer && <tfoot className="border-t bg-muted/40 font-semibold">{footer}</tfoot>}
        </table>
      </div>
      {sorted.length > pageSize && (
        <div className="flex items-center justify-between gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
          <span>
            Showing <b className="text-foreground">{current * pageSize + 1}</b>–
            <b className="text-foreground">{Math.min(sorted.length, (current + 1) * pageSize)}</b> of{" "}
            <b className="text-foreground">{sorted.length}</b>
          </span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon-sm" disabled={current === 0} onClick={() => setPage(current - 1)} aria-label="Previous page">
              <ChevronLeft />
            </Button>
            <span className="px-2">
              Page {current + 1} / {pages}
            </span>
            <Button variant="outline" size="icon-sm" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} aria-label="Next page">
              <ChevronRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
