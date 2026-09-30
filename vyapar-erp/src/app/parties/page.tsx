"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Download, Eye, FileText, MoreHorizontal, Pencil, Phone, Trash2, UserPlus, Wallet } from "lucide-react"
import { downloadCSV, fmtDate, npr } from "@/lib/format"
import { usePartySummaries } from "@/lib/hooks"
import { useStore } from "@/lib/store"
import { confirmAction, useUI } from "@/lib/ui-store"
import type { Party } from "@/lib/types"
import type { PartySummary } from "@/lib/ledger"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { DataTable, type Column } from "@/components/shared/data-table"
import { FilterBar, SearchInput, Segmented, SimpleSelect } from "@/components/shared/filters"
import { Money, PageHeader, StatCard } from "@/components/shared/ui-bits"
import { StatusBadge } from "@/components/shared/status-badge"

type Row = Party & PartySummary

export default function PartiesPage() {
  const router = useRouter()
  const parties = useStore((s) => s.parties)
  const deleteParty = useStore((s) => s.deleteParty)
  const openDialog = useUI((s) => s.openDialog)
  const summaries = usePartySummaries()
  const [q, setQ] = useState("")
  const [type, setType] = useState<"all" | "customer" | "supplier">("all")
  const [bal, setBal] = useState("all")

  const rows: Row[] = useMemo(() => parties.map((p) => ({ ...p, ...summaries[p.id] })), [parties, summaries])
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return rows.filter(
      (r) =>
        (type === "all" || r.type === type || r.type === "both") &&
        (bal === "all" || (bal === "receivable" && r.balance > 0.5) || (bal === "payable" && r.balance < -0.5) || (bal === "settled" && Math.abs(r.balance) <= 0.5)) &&
        (!s || r.name.toLowerCase().includes(s) || r.phone.includes(s) || r.address.toLowerCase().includes(s) || (r.pan ?? "").includes(s)),
    )
  }, [rows, q, type, bal])

  const receivable = rows.reduce((s, r) => s + Math.max(0, r.balance), 0)
  const payable = rows.reduce((s, r) => s + Math.max(0, -r.balance), 0)

  const remove = async (p: Party) => {
    const ok = await confirmAction({ title: `Delete ${p.name}?`, description: "This party will be removed permanently.", confirmText: "Delete", destructive: true })
    if (!ok) return
    const r = deleteParty(p.id)
    if (r.ok) toast.success("Party deleted")
    else toast.error("Cannot delete party", { description: r.error })
  }

  const columns: Column<Row>[] = [
    {
      key: "name",
      header: "Party Name",
      sortValue: (r) => r.name,
      cell: (r) => (
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
            {r.name.split(" ").slice(0, 2).map((w) => w[0]).join("")}
          </div>
          <div className="min-w-0">
            <div className="max-w-56 truncate font-medium">{r.name}</div>
            <div className="text-xs text-muted-foreground">PAN {r.pan || "—"}</div>
          </div>
        </div>
      ),
    },
    {
      key: "contact",
      header: "Phone / Address",
      cell: (r) => (
        <div>
          <div>{r.phone}</div>
          <div className="max-w-44 truncate text-xs text-muted-foreground">{r.address}</div>
        </div>
      ),
    },
    { key: "type", header: "Type", cell: (r) => <StatusBadge status={r.type} /> },
    { key: "sales", header: "Total Sales", align: "right", sortValue: (r) => r.sales, cell: (r) => (r.sales ? <Money value={r.sales} /> : <span className="text-muted-foreground">—</span>) },
    { key: "purchase", header: "Total Purchase", align: "right", sortValue: (r) => r.purchase, cell: (r) => (r.purchase ? <Money value={r.purchase} /> : <span className="text-muted-foreground">—</span>) },
    { key: "recv", header: "Receivable", align: "right", sortValue: (r) => r.balance, cell: (r) => (r.balance > 0.5 ? <span className="num font-medium text-success">{npr(r.balance)}</span> : <span className="text-muted-foreground">—</span>) },
    { key: "pay", header: "Payable", align: "right", sortValue: (r) => -r.balance, cell: (r) => (r.balance < -0.5 ? <span className="num font-medium text-destructive">{npr(-r.balance)}</span> : <span className="text-muted-foreground">—</span>) },
    { key: "last", header: "Last Transaction", sortValue: (r) => r.lastTxn ?? "", cell: (r) => (r.lastTxn ? fmtDate(r.lastTxn) : "—") },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (r) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Actions" />}>
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => router.push(`/parties/${r.id}`)}><Eye /> View Profile</DropdownMenuItem>
              <DropdownMenuItem onClick={() => openDialog({ kind: "party", party: r })}><Pencil /> Edit</DropdownMenuItem>
              {r.type !== "supplier" && <DropdownMenuItem onClick={() => router.push(`/sales?party=${r.id}`)}><FileText /> Create Invoice</DropdownMenuItem>}
              <DropdownMenuItem onClick={() => openDialog({ kind: "payment", direction: r.type === "supplier" ? "out" : "in", partyId: r.id })}><Wallet /> Record Payment</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => remove(r)}><Trash2 /> Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Parties"
        description="Customers and suppliers with their individual ledgers."
        actions={
          <>
            <Button variant="outline" className="h-9" onClick={() => downloadCSV("parties", [["Name", "Type", "Phone", "Address", "PAN", "Total Sales", "Total Purchase", "Balance"], ...filtered.map((r) => [r.name, r.type, r.phone, r.address, r.pan ?? "", r.sales, r.purchase, r.balance])])}>
              <Download /> Export
            </Button>
            <Button className="h-9" onClick={() => openDialog({ kind: "party" })}><UserPlus /> Add Party</Button>
          </>
        }
      />
      <div className="mb-4 grid grid-cols-1 gap-3 min-[480px]:grid-cols-3">
        <StatCard label="Total Parties" value={rows.length} hint={`${rows.filter((r) => r.type !== "supplier").length} customers · ${rows.filter((r) => r.type !== "customer").length} suppliers`} />
        <StatCard label="Total Receivable" value={npr(receivable)} tone="success" hint="Customers owe you" />
        <StatCard label="Total Payable" value={npr(payable)} tone="danger" hint="You owe suppliers" />
      </div>
      <FilterBar>
        <SearchInput value={q} onChange={setQ} placeholder="Search name, phone, address, PAN" className="sm:w-72" />
        <Segmented value={type} onChange={setType} options={[{ value: "all", label: "All" }, { value: "customer", label: "Customers" }, { value: "supplier", label: "Suppliers" }]} />
        <SimpleSelect value={bal} onChange={setBal} className="sm:w-44" options={[{ value: "all", label: "Any balance" }, { value: "receivable", label: "To receive" }, { value: "payable", label: "To pay" }, { value: "settled", label: "Settled" }]} />
      </FilterBar>
      <DataTable
        rows={filtered}
        columns={columns}
        getRowId={(r) => r.id}
        onRowClick={(r) => router.push(`/parties/${r.id}`)}
        initialSort={{ key: "recv", dir: "desc" }}
        emptyTitle="No parties found"
        emptyAction={<Button onClick={() => openDialog({ kind: "party" })}><UserPlus /> Add Party</Button>}
        mobileCard={(r) => (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{r.name}</div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground"><Phone className="size-3" /> {r.phone}</div>
              <StatusBadge status={r.type} className="mt-1" />
            </div>
            <div className="text-right text-sm">
              <Money value={r.balance} kind="balance" />
            </div>
          </div>
        )}
      />
    </div>
  )
}
