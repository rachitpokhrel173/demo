"use client"

import { Suspense, useMemo } from "react"
import Link from "next/link"
import { useParams, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Ban, CheckCircle2, FileX, PackagePlus, Printer, Wallet } from "lucide-react"
import { fmtDate, methodLabel, qty } from "@/lib/format"
import { docStatus, paymentsForDoc } from "@/lib/ledger"
import { usePartySummaries, usePurchasePaid, useStockMap } from "@/lib/hooks"
import { useStore } from "@/lib/store"
import { confirmAction, useUI } from "@/lib/ui-store"
import { Button } from "@/components/ui/button"
import { EmptyState, Money, PageHeader, Panel } from "@/components/shared/ui-bits"
import { StatusBadge } from "@/components/shared/status-badge"
import { InvoiceDocument } from "@/components/shared/invoice-document"

export default function PurchaseDetailPage() {
  return (
    <Suspense>
      <PurchaseDetail />
    </Suspense>
  )
}

function PurchaseDetail() {
  const { id } = useParams<{ id: string }>()
  const params = useSearchParams()
  const purchase = useStore((s) => s.purchases.find((p) => p.id === id))
  const business = useStore((s) => s.business)
  const parties = useStore((s) => s.parties)
  const payments = useStore((s) => s.payments)
  const cancelPurchase = useStore((s) => s.cancelPurchase)
  const openDialog = useUI((s) => s.openDialog)
  const paidMap = usePurchasePaid()
  const summaries = usePartySummaries()
  const stock = useStockMap()
  const history = useMemo(() => paymentsForDoc(payments, id), [payments, id])

  if (!purchase) return <EmptyState icon={FileX} title="Purchase not found" action={<Button render={<Link href="/purchases" />} nativeButton={false}>Back to purchases</Button>} />

  const party = parties.find((p) => p.id === purchase.partyId)
  const paid = Math.min(paidMap[purchase.id] ?? 0, purchase.total)
  const due = purchase.cancelled ? 0 : Math.max(0, purchase.total - paid)
  const status = docStatus(purchase.total, paid, purchase.cancelled)

  const cancel = async () => {
    const ok = await confirmAction({ title: `Cancel purchase ${purchase.number}?`, description: "Items will be removed from stock and the supplier balance will be reversed.", confirmText: "Cancel Purchase", destructive: true })
    if (!ok) return
    const r = cancelPurchase(purchase.id)
    if (!r.ok) toast.error(r.error)
    else toast.success(`Purchase ${purchase.number} cancelled`)
  }

  return (
    <div>
      <PageHeader
        back="/purchases"
        title={<span className="flex items-center gap-2">Purchase {purchase.number} <StatusBadge status={status} /></span>}
        description={`${party?.name} · Supplier bill ${purchase.supplierBillNo || "—"} · ${fmtDate(purchase.date)}`}
        actions={
          <>
            <Button variant="outline" className="h-9" onClick={() => window.print()}><Printer /> Print</Button>
            {due > 0 && <Button className="h-9" onClick={() => openDialog({ kind: "payment", direction: "out", purchaseId: purchase.id })}><Wallet /> Pay Supplier</Button>}
          </>
        }
      />
      {params.get("created") === "1" && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-success/30 bg-success/5 p-4 print:hidden">
          <CheckCircle2 className="mt-0.5 size-5 text-success" />
          <div>
            <div className="text-sm font-semibold">Purchase saved and stock updated</div>
            <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground">
              {purchase.items.map((it) => (
                <li key={it.productId} className="flex items-center gap-1.5">
                  <PackagePlus className="size-3.5 text-success" />
                  <Link href={`/products/${it.productId}`} className="hover:underline">{it.name}</Link>: +{qty(it.qty)} {it.unit} → now <b className="text-foreground">{qty(stock[it.productId] ?? 0)} {it.unit}</b>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <InvoiceDocument
          business={business}
          title="PURCHASE BILL"
          number={purchase.number}
          date={purchase.date}
          party={party}
          partyName={party?.name ?? ""}
          partyLabel="Supplier"
          items={purchase.items}
          totals={purchase}
          paid={paid}
          notes={purchase.notes}
          extraMeta={[{ label: "Supplier Bill", value: purchase.supplierBillNo || "—" }]}
          cancelled={purchase.cancelled}
        />
        <div className="space-y-4 print:hidden">
          <Panel title="Payment Status">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Bill Total</span><Money value={purchase.total} className="font-medium" /></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Paid</span><Money value={paid} className="text-success" /></div>
              <div className="flex justify-between border-t pt-2 font-semibold"><span>Due</span><Money value={due} kind="due" /></div>
            </div>
          </Panel>
          <Panel title="Payments" bodyClassName="p-0">
            {history.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">No payment made yet.</div>
            ) : (
              <ul className="divide-y">
                {history.map((h) => (
                  <li key={h.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <div>
                      <div className="font-medium">{h.number}</div>
                      <div className="text-xs text-muted-foreground">{fmtDate(h.date)} · {methodLabel(h.method)}</div>
                    </div>
                    <Money value={h.applied} className="font-medium" />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          {party && (
            <Panel title="Supplier">
              <Link href={`/parties/${party.id}`} className="text-sm font-medium text-primary hover:underline">{party.name}</Link>
              <div className="text-xs text-muted-foreground">{party.phone} · {party.address}</div>
              <div className="mt-3 flex justify-between text-sm"><span className="text-muted-foreground">Balance</span><Money value={summaries[party.id]?.balance ?? 0} kind="balance" /></div>
            </Panel>
          )}
          {!purchase.cancelled && <Button variant="destructive" className="h-9 w-full" onClick={cancel}><Ban /> Cancel Purchase</Button>}
        </div>
      </div>
    </div>
  )
}
