import { cn } from "@/lib/utils"

type Tone = "green" | "amber" | "red" | "gray" | "blue" | "violet"

const toneCls: Record<Tone, string> = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  amber: "bg-amber-50 text-amber-800 ring-amber-600/25",
  red: "bg-red-50 text-red-700 ring-red-600/20",
  gray: "bg-slate-100 text-slate-600 ring-slate-500/20",
  blue: "bg-blue-50 text-blue-700 ring-blue-600/20",
  violet: "bg-violet-50 text-violet-700 ring-violet-600/20",
}

const STATUS: Record<string, { label: string; tone: Tone }> = {
  paid: { label: "Paid", tone: "green" },
  partial: { label: "Partial", tone: "amber" },
  due: { label: "Due", tone: "red" },
  cancelled: { label: "Cancelled", tone: "gray" },
  draft: { label: "Draft", tone: "gray" },
  in_progress: { label: "In Progress", tone: "blue" },
  completed: { label: "Completed", tone: "green" },
  active: { label: "Active", tone: "green" },
  inactive: { label: "Inactive", tone: "gray" },
  in: { label: "In Stock", tone: "green" },
  low: { label: "Low Stock", tone: "amber" },
  out: { label: "Out of Stock", tone: "red" },
  customer: { label: "Customer", tone: "blue" },
  supplier: { label: "Supplier", tone: "violet" },
  both: { label: "Customer + Supplier", tone: "amber" },
  raw: { label: "Raw Material", tone: "violet" },
  finished: { label: "Finished Good", tone: "blue" },
  trading: { label: "Trading", tone: "gray" },
}

export function StatusBadge({ status, label, tone, className }: { status?: string; label?: string; tone?: Tone; className?: string }) {
  const def = status ? STATUS[status] : undefined
  const t = tone ?? def?.tone ?? "gray"
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-full px-2 text-[11px] font-medium whitespace-nowrap ring-1 ring-inset",
        toneCls[t],
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full bg-current opacity-70")} />
      {label ?? def?.label ?? status}
    </span>
  )
}
