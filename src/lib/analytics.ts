import { addDays, format, parseISO, startOfMonth, startOfWeek, subDays, subMonths, subWeeks } from "date-fns"
import { round2 } from "./format"

export type Granularity = "daily" | "weekly" | "monthly"

/** Groups dated amounts into the last `count` days / weeks / months. */
export function bucketize(records: { date: string; amount: number }[], g: Granularity, count?: number) {
  const now = new Date()
  const n = count ?? (g === "daily" ? 14 : g === "weekly" ? 12 : 6)
  const buckets: { key: string; label: string; value: number }[] = []
  const keyOf = (d: Date) =>
    g === "daily" ? format(d, "yyyy-MM-dd") : g === "weekly" ? format(startOfWeek(d), "yyyy-MM-dd") : format(startOfMonth(d), "yyyy-MM")
  for (let i = n - 1; i >= 0; i--) {
    const d = g === "daily" ? subDays(now, i) : g === "weekly" ? subWeeks(now, i) : subMonths(now, i)
    const label =
      g === "daily" ? format(d, "dd MMM") : g === "weekly" ? `${format(startOfWeek(d), "dd MMM")}` : format(d, "MMM yyyy")
    buckets.push({ key: keyOf(d), label, value: 0 })
  }
  const idx = Object.fromEntries(buckets.map((b, i) => [b.key, i]))
  for (const r of records) {
    const k = keyOf(parseISO(r.date))
    if (k in idx) buckets[idx[k]].value += r.amount
  }
  return buckets.map((b) => ({ ...b, value: round2(b.value) }))
}

export function lastNDays(n: number) {
  const now = new Date()
  return Array.from({ length: n }, (_, i) => format(addDays(subDays(now, n - 1), i), "yyyy-MM-dd"))
}
