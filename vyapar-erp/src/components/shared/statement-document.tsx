"use client"

import { fmtDate, num } from "@/lib/format"
import type { LedgerRow } from "@/lib/ledger"
import type { BusinessProfile, Party } from "@/lib/types"
import { cn } from "@/lib/utils"

const drcr = (v: number) => (Math.abs(v) < 0.5 ? "0.00" : `${num(Math.abs(v), true)} ${v > 0 ? "Dr" : "Cr"}`)

/** Printable party ledger statement. */
export function StatementDocument({
  business,
  party,
  rows,
  opening,
  closing,
  from,
  to,
  className,
}: {
  business: BusinessProfile
  party: Party
  rows: LedgerRow[]
  opening: number
  closing: number
  from: string
  to: string
  className?: string
}) {
  const totalDr = rows.reduce((s, r) => s + r.debit, 0)
  const totalCr = rows.reduce((s, r) => s + r.credit, 0)
  return (
    <div className={cn("print-area bg-white p-8 text-[12.5px] text-slate-800", className)}>
      <div className="flex items-start justify-between border-b-2 border-slate-800 pb-3">
        <div>
          <div className="text-lg font-bold text-slate-900">{business.name}</div>
          <div className="text-slate-600">{business.address}</div>
          <div className="text-slate-600">Ph: {business.phone} · PAN/VAT: {business.pan}</div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold">PARTY STATEMENT</div>
          <div className="text-slate-600">{fmtDate(from)} to {fmtDate(to)}</div>
        </div>
      </div>
      <div className="mt-3 flex justify-between">
        <div>
          <div className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Party</div>
          <div className="font-semibold">{party.name}</div>
          <div className="text-slate-600">{party.address} · Ph: {party.phone}</div>
          <div className="text-slate-600">PAN/VAT: {party.pan || "—"}</div>
        </div>
        <div className="text-right">
          <div className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Closing Balance</div>
          <div className="text-base font-bold">NPR {drcr(closing)}</div>
          <div className="text-slate-600">{closing > 0.5 ? "Receivable from party" : closing < -0.5 ? "Payable to party" : "Settled"}</div>
        </div>
      </div>
      <table className="mt-4 w-full border-collapse">
        <thead>
          <tr className="bg-slate-100 text-left text-[11px] text-slate-600 uppercase">
            <th className="border border-slate-200 px-2 py-1.5">Date</th>
            <th className="border border-slate-200 px-2 py-1.5">Particulars</th>
            <th className="border border-slate-200 px-2 py-1.5">Ref No.</th>
            <th className="border border-slate-200 px-2 py-1.5 text-right">Debit</th>
            <th className="border border-slate-200 px-2 py-1.5 text-right">Credit</th>
            <th className="border border-slate-200 px-2 py-1.5 text-right">Balance</th>
          </tr>
        </thead>
        <tbody>
          <tr className="font-medium">
            <td className="border border-slate-200 px-2 py-1">{fmtDate(from)}</td>
            <td className="border border-slate-200 px-2 py-1" colSpan={4}>Opening Balance</td>
            <td className="num border border-slate-200 px-2 py-1 text-right">{drcr(opening)}</td>
          </tr>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="border border-slate-200 px-2 py-1 whitespace-nowrap">{fmtDate(r.date)}</td>
              <td className="border border-slate-200 px-2 py-1">{r.type}</td>
              <td className="border border-slate-200 px-2 py-1">{r.ref}</td>
              <td className="num border border-slate-200 px-2 py-1 text-right">{r.debit ? num(r.debit, true) : ""}</td>
              <td className="num border border-slate-200 px-2 py-1 text-right">{r.credit ? num(r.credit, true) : ""}</td>
              <td className="num border border-slate-200 px-2 py-1 text-right">{drcr(r.balance)}</td>
            </tr>
          ))}
          <tr className="bg-slate-50 font-semibold">
            <td className="border border-slate-200 px-2 py-1.5" colSpan={3}>Total</td>
            <td className="num border border-slate-200 px-2 py-1.5 text-right">{num(totalDr, true)}</td>
            <td className="num border border-slate-200 px-2 py-1.5 text-right">{num(totalCr, true)}</td>
            <td className="num border border-slate-200 px-2 py-1.5 text-right">{drcr(closing)}</td>
          </tr>
        </tbody>
      </table>
      <div className="mt-10 flex justify-between text-slate-600">
        <div>Dr = amount receivable from party · Cr = amount payable to party</div>
        <div className="border-t border-slate-400 px-8 pt-1">Authorized Signature</div>
      </div>
    </div>
  )
}
