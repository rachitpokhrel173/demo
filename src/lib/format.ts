import { format, parseISO } from "date-fns"
import type { LineItem, PaymentMethod, Totals } from "./types"

const inr0 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 })
const inr2 = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Nepali/Indian digit grouping: 2,45,800 */
export function num(n: number, decimals = false) {
  return (decimals ? inr2 : inr0).format(round2(n))
}

export function npr(n: number, opts: { decimals?: boolean; sign?: boolean } = {}) {
  const v = round2(n)
  const s = num(Math.abs(v), opts.decimals ?? !Number.isInteger(v))
  const neg = v < 0 ? "-" : opts.sign && v > 0 ? "+" : ""
  return `${neg}NPR ${s}`
}

/** Short form for chart axes: 2.4L, 45K */
export function nprShort(n: number) {
  const a = Math.abs(n)
  if (a >= 1_00_00_000) return `${(n / 1_00_00_000).toFixed(1)}Cr`
  if (a >= 1_00_000) return `${(n / 1_00_000).toFixed(1)}L`
  if (a >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return `${n}`
}

export function qty(n: number) {
  return Number.isInteger(n) ? inr0.format(n) : inr2.format(n)
}

export function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function fmtDate(iso: string, pattern = "dd MMM yyyy") {
  try {
    return format(parseISO(iso), pattern)
  } catch {
    return iso
  }
}

export function todayISO() {
  return format(new Date(), "yyyy-MM-dd")
}

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank" },
  { value: "esewa", label: "eSewa" },
  { value: "khalti", label: "Khalti" },
  { value: "credit", label: "Credit / Due" },
  { value: "other", label: "Other" },
]

export function methodLabel(m: PaymentMethod) {
  return PAYMENT_METHODS.find((x) => x.value === m)?.label ?? m
}

export function uid(prefix = "") {
  return prefix + Math.random().toString(36).slice(2, 10)
}

/** Line and bill totals. Line discount applies before VAT; bill discount is spread before VAT. */
export function computeTotals(items: LineItem[], billDiscount = 0): Totals {
  let subtotal = 0
  let lineDiscount = 0
  let taxableBeforeBill = 0
  let taxBeforeBill = 0
  for (const it of items) {
    const gross = it.qty * it.rate
    const net = Math.max(0, gross - it.discount)
    subtotal += gross
    lineDiscount += it.discount
    taxableBeforeBill += net
    taxBeforeBill += (net * it.vatRate) / 100
  }
  const bd = Math.min(billDiscount, taxableBeforeBill)
  const ratio = taxableBeforeBill > 0 ? (taxableBeforeBill - bd) / taxableBeforeBill : 0
  const taxable = taxableBeforeBill - bd
  const tax = taxBeforeBill * ratio
  return {
    subtotal: round2(subtotal),
    discount: round2(lineDiscount + bd),
    taxable: round2(taxable),
    tax: round2(tax),
    total: round2(taxable + tax),
  }
}

// ---------- Amount in words (Nepali/Indian numbering) ----------
const ones = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
]
const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

function twoDigits(n: number) {
  if (n < 20) return ones[n]
  return `${tens[Math.floor(n / 10)]}${n % 10 ? " " + ones[n % 10] : ""}`
}

function threeDigits(n: number) {
  const h = Math.floor(n / 100)
  const r = n % 100
  return [h ? `${ones[h]} Hundred` : "", r ? twoDigits(r) : ""].filter(Boolean).join(" ")
}

export function amountInWords(amount: number) {
  const rupees = Math.floor(amount)
  const paisa = Math.round((amount - rupees) * 100)
  if (rupees === 0 && paisa === 0) return "Zero Rupees Only"
  const parts: string[] = []
  let n = rupees
  const crore = Math.floor(n / 1_00_00_000); n %= 1_00_00_000
  const lakh = Math.floor(n / 1_00_000); n %= 1_00_000
  const thousand = Math.floor(n / 1000); n %= 1000
  if (crore) parts.push(`${threeDigits(crore)} Crore`)
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`)
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`)
  if (n) parts.push(threeDigits(n))
  let s = `Rupees ${parts.join(" ")}`
  if (paisa) s += ` and ${twoDigits(paisa)} Paisa`
  return `${s} Only`
}

// ---------- CSV export ----------
export function downloadCSV(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n")
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
