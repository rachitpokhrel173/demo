"use client"

import { Suspense, useEffect, useMemo } from "react"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Ban, CheckCircle2, Download, FileX, Plus, Printer, Share2, Wallet } from "lucide-react"
import { fmtDate, methodLabel, npr } from "@/lib/format"
import { docStatus, paymentsForDoc } from "@/lib/ledger"
import { useInvoicePaid, usePartySummaries } from "@/lib/hooks"
import { useStore } from "@/lib/store"
import { confirmAction, useUI } from "@/lib/ui-store"
import { Button } from "@/components/ui/button"
import { EmptyState, Money, PageHeader, Panel } from "@/components/shared/ui-bits"
import { StatusBadge } from "@/components/shared/status-badge"
import { InvoiceDocument } from "@/components/shared/invoice-document"

export default function InvoiceDetailPage() {
  return (
    <Suspense>
      <InvoiceDetail />
    </Suspense>
  )
}

function InvoiceDetail() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const params = useSearchParams()
  const invoice = useStore((s) => s.invoices.find((i) => i.id === id))
  const business = useStore((s) => s.business)
  const parties = useStore((s) => s.parties)
  const payments = useStore((s) => s.payments)
  const cancelInvoice = useStore((s) => s.cancelInvoice)
  const openDialog = useUI((s) => s.openDialog)
  const paidMap = useInvoicePaid()
  const summaries = usePartySummaries()
  const party = parties.find((p) => p.id === invoice?.partyId)
  const history = useMemo(() => paymentsForDoc(payments, id), [payments, id])

  useEffect(() => {
    if (params.get("print") === "1" && invoice) {
      const t = setTimeout(() => window.print(), 400)
      return () => clearTimeout(t)
    }
  }, [params, invoice])

  if (!invoice) {
    return <EmptyState icon={FileX} title="Invoice not found" description="It may have been removed or the link is incorrect." action={<Button render={<Link href="/invoices" />} nativeButton={false}>Back to invoices</Button>} />
  }

  const paid = Math.min(paidMap[invoice.id] ?? 0, invoice.total)
  const due = invoice.cancelled ? 0 : Math.max(0, invoice.total - paid)
  const status = docStatus(invoice.total, paid, invoice.cancelled)
  const mode = history.length ? [...new Set(history.map((h) => methodLabel(h.method)))].join(", ") : "Credit"

  const share = async () => {
    const text = `${business.name}\nInvoice ${invoice.number} dated ${fmtDate(invoice.date)}\nAmount: ${npr(invoice.total)}\nDue: ${npr(due)}`
    try {
      if (navigator.share) await navigator.share({ title: `Invoice ${invoice.number}`, text, url: window.location.href })
      else {
        await navigator.clipboard.writeText(`${text}\n${window.location.href}`)
        toast.success("Invoice details copied", { description: "Paste it in WhatsApp, Viber or email." })
      }
    } catch {
      /* user dismissed share sheet */
    }
  }

  const cancel = async () => {
    const ok = await confirmAction({
      title: `Cancel invoice ${invoice.number}?`,
      description: "Stock will be returned to inventory and the amount will be removed from the customer's balance. This cannot be undone.",
      confirmText: "Cancel Invoice",
      destructive: true,
    })
    if (!ok) return
    cancelInvoice(invoice.id)
    toast.success(`Invoice ${invoice.number} cancelled`, { description: "Stock returned to inventory." })
  }

  return (
    <div>
      <PageHeader
        back="/invoices"
        title={
          <span className="flex items-center gap-2">
            Invoice {invoice.number} <StatusBadge status={status} />
          </span>
        }
        description={`${invoice.customerName} · ${fmtDate(invoice.date)}`}
        actions={
          <>
            <Button variant="outline" className="h-9" onClick={() => window.print()}><Printer /> Print</Button>
            <Button variant="outline" className="h-9" onClick={() => { toast.info("Choose “Save as PDF” as the printer to download."); setTimeout(() => window.print(), 300) }}><Download /> PDF</Button>
            <Button variant="outline" className="h-9" onClick={share}><Share2 /> Share</Button>
            {due > 0 && invoice.partyId && (
              <Button className="h-9" onClick={() => openDialog({ kind: "payment", direction: "in", invoiceId: invoice.id })}><Wallet /> Record Payment</Button>
            )}
          </>
        }
      />

      {params.get("created") === "1" && (
        <div className="mb-4 flex flex-col gap-3 rounded-lg border border-success/30 bg-success/5 p-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-5 text-success" />
            <div>
              <div className="text-sm font-semibold">Invoice {invoice.number} created successfully</div>
              <div className="text-sm text-muted-foreground">
                Stock has been reduced{party ? ` and ${party.name}'s ledger updated` : ""}.{due > 0 ? ` Remaining due: ${npr(due)}.` : ""}
              </div>
            </div>
          </div>
          <Button variant="outline" className="h-9 shrink-0" onClick={() => router.push("/sales")}><Plus /> New Sale</Button>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <InvoiceDocument
          business={business}
          title={business.vatRegistered ? "TAX INVOICE" : "INVOICE"}
          number={invoice.number}
          date={invoice.date}
          party={party}
          partyName={invoice.customerName}
          items={invoice.items}
          totals={invoice}
          paid={paid}
          paymentMode={mode}
          notes={invoice.notes}
          cancelled={invoice.cancelled}
        />

        <div className="space-y-4 print:hidden">
          <Panel title="Payment Summary">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Invoice Total</span><Money value={invoice.total} className="font-medium" /></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Paid</span><Money value={paid} className="text-success" /></div>
              <div className="flex justify-between border-t pt-2 font-semibold"><span>Remaining Due</span><Money value={due} kind="due" /></div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-success" style={{ width: `${invoice.cancelled ? 0 : (paid / invoice.total) * 100}%` }} />
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{invoice.cancelled ? "Cancelled" : `${Math.round((paid / invoice.total) * 100)}% collected`}</div>
          </Panel>

          <Panel title="Payment History" bodyClassName="p-0">
            {history.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">No payment received yet.</div>
            ) : (
              <ul className="divide-y">
                {history.map((h) => (
                  <li key={h.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <div>
                      <div className="font-medium">{h.number}</div>
                      <div className="text-xs text-muted-foreground">{fmtDate(h.date)} · {methodLabel(h.method)}</div>
                    </div>
                    <Money value={h.applied} className="font-medium text-success" />
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {party && (
            <Panel title="Customer">
              <Link href={`/parties/${party.id}`} className="text-sm font-medium text-primary hover:underline">{party.name}</Link>
              <div className="text-xs text-muted-foreground">{party.phone} · {party.address}</div>
              <div className="mt-3 flex justify-between text-sm"><span className="text-muted-foreground">Total balance</span><Money value={summaries[party.id]?.balance ?? 0} kind="balance" /></div>
            </Panel>
          )}

          {!invoice.cancelled && (
            <Button variant="destructive" className="h-9 w-full" onClick={cancel}><Ban /> Cancel Invoice</Button>
          )}
        </div>
      </div>
    </div>
  )
}
