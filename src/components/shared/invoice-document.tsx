"use client"

import { amountInWords, fmtDate, num, qty } from "@/lib/format"
import type { BusinessProfile, LineItem, Party, Totals } from "@/lib/types"
import { cn } from "@/lib/utils"

/** Printable A4 bill used for sales invoices and purchase bills. */
export function InvoiceDocument({
  business,
  title,
  number,
  date,
  party,
  partyName,
  items,
  totals,
  paid,
  paymentMode,
  notes,
  extraMeta,
  cancelled,
  partyLabel = "Bill To",
  className,
}: {
  business: BusinessProfile
  title: string
  number: string
  date: string
  party?: Party
  partyName: string
  items: LineItem[]
  totals: Totals
  paid: number
  paymentMode?: string
  notes?: string
  extraMeta?: { label: string; value: string }[]
  cancelled?: boolean
  partyLabel?: string
  className?: string
}) {
  const due = Math.max(0, totals.total - paid)
  return (
    <div className={cn("print-area relative mx-auto w-full min-w-0 max-w-[820px] bg-white p-6 text-[13px] text-slate-800 shadow-sm ring-1 ring-slate-200 sm:p-10", className)}>
      {cancelled && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="-rotate-12 rounded-md border-4 border-red-500/60 px-6 py-2 text-5xl font-black tracking-widest text-red-500/60">CANCELLED</span>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col gap-4 border-b-2 border-slate-800 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-md bg-[#1f4fa3] text-lg font-black text-white">{business.logoText}</div>
          <div>
            <div className="text-lg leading-tight font-bold text-slate-900">{business.name}</div>
            <div className="text-slate-600">{business.address}</div>
            <div className="text-slate-600">Ph: {business.phone} · {business.email}</div>
            <div className="mt-0.5 font-semibold text-slate-700">PAN/VAT No: {business.pan}</div>
          </div>
        </div>
        <div className="text-left sm:text-right">
          <div className="text-xl font-bold tracking-wide text-slate-900">{title}</div>
          <table className="mt-1 text-[12px] sm:ml-auto">
            <tbody>
              <tr><td className="pr-3 text-slate-500">{title.includes("PURCHASE") ? "Bill No." : "Invoice No."}</td><td className="font-semibold">{number}</td></tr>
              <tr><td className="pr-3 text-slate-500">Date</td><td className="font-semibold">{fmtDate(date)}</td></tr>
              {paymentMode && <tr><td className="pr-3 text-slate-500">Payment</td><td className="font-semibold">{paymentMode}</td></tr>}
              {extraMeta?.map((m) => (
                <tr key={m.label}><td className="pr-3 text-slate-500">{m.label}</td><td className="font-semibold">{m.value}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Party */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <div className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">{partyLabel}</div>
          <div className="mt-1 text-sm font-semibold text-slate-900">{partyName}</div>
          {party && (
            <>
              <div className="text-slate-600">{party.address}</div>
              <div className="text-slate-600">Ph: {party.phone}</div>
              <div className="text-slate-600">PAN/VAT: {party.pan || "—"}</div>
            </>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-[12.5px]">
          <thead>
            <tr className="bg-slate-100 text-left text-[11px] tracking-wide text-slate-600 uppercase">
              <th className="border border-slate-200 px-2 py-2 text-center">S.N.</th>
              <th className="border border-slate-200 px-2 py-2">Particulars</th>
              <th className="border border-slate-200 px-2 py-2 text-right">Qty</th>
              <th className="border border-slate-200 px-2 py-2">Unit</th>
              <th className="border border-slate-200 px-2 py-2 text-right">Rate</th>
              <th className="border border-slate-200 px-2 py-2 text-right">Discount</th>
              <th className="border border-slate-200 px-2 py-2 text-right">Amount (NPR)</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i}>
                <td className="border border-slate-200 px-2 py-1.5 text-center">{i + 1}</td>
                <td className="border border-slate-200 px-2 py-1.5">{it.name}</td>
                <td className="num border border-slate-200 px-2 py-1.5 text-right">{qty(it.qty)}</td>
                <td className="border border-slate-200 px-2 py-1.5">{it.unit}</td>
                <td className="num border border-slate-200 px-2 py-1.5 text-right">{num(it.rate, true)}</td>
                <td className="num border border-slate-200 px-2 py-1.5 text-right">{it.discount ? num(it.discount, true) : "—"}</td>
                <td className="num border border-slate-200 px-2 py-1.5 text-right font-medium">{num(it.qty * it.rate - it.discount, true)}</td>
              </tr>
            ))}
            {Array.from({ length: Math.max(0, 4 - items.length) }).map((_, i) => (
              <tr key={`pad-${i}`} className="h-7">
                {Array.from({ length: 7 }).map((__, j) => (
                  <td key={j} className="border border-slate-200" />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:justify-between">
        <div className="max-w-sm space-y-2">
          <div>
            <div className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Amount in words</div>
            <div className="font-medium text-slate-800 italic">{amountInWords(totals.total)}</div>
          </div>
          {notes && (
            <div>
              <div className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Remarks</div>
              <div className="text-slate-700">{notes}</div>
            </div>
          )}
          {business.bankDetails && !title.includes("PURCHASE") && (
            <div>
              <div className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Bank Details</div>
              <div className="text-slate-700">{business.bankDetails}</div>
            </div>
          )}
        </div>
        <table className="w-full text-[12.5px] sm:w-72">
          <tbody>
            <TR label="Sub Total" value={num(totals.subtotal, true)} />
            <TR label="Discount" value={totals.discount ? `− ${num(totals.discount, true)}` : "0.00"} />
            <TR label="Taxable Amount" value={num(totals.taxable, true)} />
            <TR label="VAT 13%" value={num(totals.tax, true)} />
            <tr className="border-y-2 border-slate-800 text-sm font-bold">
              <td className="py-1.5">Grand Total</td>
              <td className="num py-1.5 text-right">NPR {num(totals.total, true)}</td>
            </tr>
            <TR label="Paid" value={num(paid, true)} />
            <tr className="font-semibold">
              <td className="py-1">Due</td>
              <td className={cn("num py-1 text-right", due > 0.5 && "text-red-600")}>NPR {num(due, true)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Signatures */}
      <div className="mt-14 grid grid-cols-3 gap-6 text-center text-[12px] text-slate-600">
        <div className="border-t border-slate-400 pt-1">Received By</div>
        <div className="border-t border-slate-400 pt-1">Prepared By</div>
        <div className="border-t border-slate-400 pt-1">Authorized Signature</div>
      </div>
      {business.invoiceFooter && <div className="mt-6 border-t pt-3 text-center text-[11.5px] text-slate-500">{business.invoiceFooter}</div>}
      <div className="mt-1 text-center text-[10px] text-slate-400">Computer generated bill · Byapar ERP</div>
    </div>
  )
}

function TR({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td className="py-1 text-slate-600">{label}</td>
      <td className="num py-1 text-right">{value}</td>
    </tr>
  )
}
