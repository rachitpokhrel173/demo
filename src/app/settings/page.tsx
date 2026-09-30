"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Building2, CreditCard, FileText, Pencil, Plus, RotateCcw, Ruler, Tags, Trash2, Upload, UserPlus, Users } from "lucide-react"
import { useStore } from "@/lib/store"
import { confirmAction } from "@/lib/ui-store"
import type { AppUser, BusinessProfile, UserRole } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Field, PageHeader, Panel } from "@/components/shared/ui-bits"
import { SimpleSelect } from "@/components/shared/filters"
import { StatusBadge } from "@/components/shared/status-badge"
import { FormDialog } from "@/components/shared/form-dialog"

const TABS = [
  { value: "business", label: "Business Profile", icon: Building2 },
  { value: "invoice", label: "Invoice Settings", icon: FileText },
  { value: "users", label: "Users", icon: Users },
  { value: "payments", label: "Payment Methods", icon: CreditCard },
  { value: "units", label: "Units", icon: Ruler },
  { value: "categories", label: "Categories", icon: Tags },
]

export default function SettingsPage() {
  const router = useRouter()
  return (
    <div>
      <PageHeader
        title="Settings"
        description="Business details, invoice format, users and master data."
        actions={
          <Button
            variant="outline"
            className="h-9"
            onClick={async () => {
              if (!(await confirmAction({ title: "Reset demo data?", description: "All changes will be replaced with fresh sample data.", confirmText: "Reset Data", destructive: true }))) return
              useStore.getState().resetDemo()
              toast.success("Demo data reset")
              router.push("/")
            }}
          >
            <RotateCcw /> Reset Demo Data
          </Button>
        }
      />
      <Tabs defaultValue="business" orientation="vertical" className="flex-col gap-5 lg:flex-row">
        <TabsList variant="line" className="h-fit w-full flex-row justify-start overflow-x-auto rounded-lg border bg-card p-1.5 lg:w-56 lg:flex-col lg:items-stretch">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="flex-none justify-start gap-2 px-3 py-2 data-active:bg-primary/10 data-active:text-primary lg:w-full after:hidden">
              <t.icon /> {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="min-w-0 flex-1">
          <TabsContent value="business"><BusinessTab /></TabsContent>
          <TabsContent value="invoice"><InvoiceTab /></TabsContent>
          <TabsContent value="users"><UsersTab /></TabsContent>
          <TabsContent value="payments"><PaymentMethodsTab /></TabsContent>
          <TabsContent value="units"><ListTab kind="units" /></TabsContent>
          <TabsContent value="categories"><ListTab kind="categories" /></TabsContent>
        </div>
      </Tabs>
    </div>
  )
}

function useBusinessForm() {
  const business = useStore((s) => s.business)
  const update = useStore((s) => s.updateBusiness)
  const [f, setF] = useState<BusinessProfile>(business)
  const set = <K extends keyof BusinessProfile>(k: K, v: BusinessProfile[K]) => setF((s) => ({ ...s, [k]: v }))
  const save = () => {
    update(f)
    toast.success("Settings saved")
  }
  return { f, set, save }
}

function BusinessTab() {
  const { f, set, save } = useBusinessForm()
  return (
    <Panel title="Business Profile" description="Shown on invoices, statements and reports." actions={<Button onClick={save}>Save Changes</Button>}>
      <div className="grid gap-5 md:grid-cols-[140px_1fr]">
        <div className="flex flex-col items-center gap-2">
          <div className="flex size-28 items-center justify-center rounded-lg bg-[#1f4fa3] text-3xl font-black text-white">{f.logoText}</div>
          <Button variant="outline" size="sm" onClick={() => toast.info("Logo upload will be available in the full version", { description: "For the demo, change the logo text instead." })}>
            <Upload /> Upload Logo
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Business Name" required className="sm:col-span-2"><Input value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Address" className="sm:col-span-2"><Input value={f.address} onChange={(e) => set("address", e.target.value)} /></Field>
          <Field label="Phone"><Input value={f.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
          <Field label="Email"><Input value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
          <Field label="PAN / VAT No."><Input value={f.pan} onChange={(e) => set("pan", e.target.value.replace(/\D/g, "").slice(0, 9))} /></Field>
          <Field label="Logo Text" hint="Short initials used as logo"><Input value={f.logoText} maxLength={4} onChange={(e) => set("logoText", e.target.value.toUpperCase())} /></Field>
          <Field label="Bank Details (printed on invoice)" className="sm:col-span-2"><Input value={f.bankDetails} onChange={(e) => set("bankDetails", e.target.value)} /></Field>
        </div>
      </div>
    </Panel>
  )
}

function InvoiceTab() {
  const { f, set, save } = useBusinessForm()
  return (
    <Panel title="Invoice Settings" description="Numbering, VAT and footer text." actions={<Button onClick={save}>Save Changes</Button>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Invoice Prefix" hint={`Next invoice: ${f.invoicePrefix}${f.nextInvoiceNo}`}><Input value={f.invoicePrefix} onChange={(e) => set("invoicePrefix", e.target.value)} /></Field>
        <Field label="Next Invoice Number"><Input type="number" min={1} value={f.nextInvoiceNo} onChange={(e) => set("nextInvoiceNo", Number(e.target.value) || 1)} /></Field>
        <Field label="Purchase Prefix" hint={`Next purchase: ${f.purchasePrefix}${f.nextPurchaseNo}`}><Input value={f.purchasePrefix} onChange={(e) => set("purchasePrefix", e.target.value)} /></Field>
        <Field label="Next Purchase Number"><Input type="number" min={1} value={f.nextPurchaseNo} onChange={(e) => set("nextPurchaseNo", Number(e.target.value) || 1)} /></Field>
        <Field label="Default VAT Rate">
          <SimpleSelect value={String(f.defaultVat)} onChange={(v) => set("defaultVat", Number(v))} options={[{ value: "13", label: "13% (Nepal standard)" }, { value: "0", label: "0% (Exempt)" }]} />
        </Field>
        <Field label="VAT Registered">
          <label className="flex h-9 items-center gap-2 text-sm">
            <Switch checked={f.vatRegistered} onCheckedChange={(v) => set("vatRegistered", v)} />
            {f.vatRegistered ? "Print as TAX INVOICE and apply VAT by default" : "Print as INVOICE (PAN only)"}
          </label>
        </Field>
        <Field label="Invoice Footer Text" className="sm:col-span-2"><Textarea rows={2} value={f.invoiceFooter} onChange={(e) => set("invoiceFooter", e.target.value)} /></Field>
      </div>
    </Panel>
  )
}

function UsersTab() {
  const users = useStore((s) => s.users)
  const saveUser = useStore((s) => s.saveUser)
  const deleteUser = useStore((s) => s.deleteUser)
  const [editing, setEditing] = useState<Partial<AppUser> | null>(null)
  const perms: Record<UserRole, string> = {
    Admin: "Full access including settings and users",
    Accountant: "Billing, payments, expenses and reports",
    Staff: "Sales, purchase entry and stock only",
  }
  return (
    <Panel title="Users & Roles" description="Who can use the system and what they can access." actions={<Button onClick={() => setEditing({ role: "Staff", active: true })}><UserPlus /> Add User</Button>} bodyClassName="p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-2 text-left font-semibold">Name</th>
              <th className="px-4 py-2 text-left font-semibold">Role</th>
              <th className="px-4 py-2 text-left font-semibold">Access</th>
              <th className="px-4 py-2 text-left font-semibold">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="px-4 py-2.5">
                  <div className="font-medium">{u.name}</div>
                  <div className="text-xs text-muted-foreground">{u.email} · {u.phone}</div>
                </td>
                <td className="px-4 py-2.5"><StatusBadge label={u.role} tone={u.role === "Admin" ? "violet" : u.role === "Accountant" ? "blue" : "gray"} /></td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{perms[u.role]}</td>
                <td className="px-4 py-2.5"><StatusBadge status={u.active ? "active" : "inactive"} /></td>
                <td className="px-4 py-2.5 text-right">
                  <Button variant="ghost" size="icon-sm" onClick={() => setEditing(u)} aria-label="Edit user"><Pencil /></Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={u.role === "Admin" && users.filter((x) => x.role === "Admin").length === 1}
                    onClick={async () => {
                      if (!(await confirmAction({ title: `Remove ${u.name}?`, confirmText: "Remove", destructive: true }))) return
                      deleteUser(u.id)
                      toast.success("User removed")
                    }}
                    aria-label="Remove user"
                  >
                    <Trash2 />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && (
        <FormDialog
          open
          onOpenChange={(o) => !o && setEditing(null)}
          title={editing.id ? "Edit User" : "Add User"}
          onSubmit={() => {
            if (!editing.name?.trim() || !editing.email?.trim()) return toast.error("Name and email are required")
            saveUser({ id: editing.id, name: editing.name.trim(), email: editing.email.trim(), phone: editing.phone ?? "", role: editing.role ?? "Staff", active: editing.active ?? true })
            toast.success(editing.id ? "User updated" : "User added", { description: "In the full version an invite will be sent by email." })
            setEditing(null)
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full Name" required className="sm:col-span-2"><Input autoFocus value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
            <Field label="Email" required><Input type="email" value={editing.email ?? ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></Field>
            <Field label="Phone"><Input value={editing.phone ?? ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></Field>
            <Field label="Role" hint={perms[editing.role ?? "Staff"]}>
              <SimpleSelect value={editing.role ?? "Staff"} onChange={(v) => setEditing({ ...editing, role: v as UserRole })} options={["Admin", "Accountant", "Staff"].map((r) => ({ value: r, label: r }))} />
            </Field>
            <Field label="Active">
              <label className="flex h-9 items-center gap-2 text-sm"><Switch checked={editing.active ?? true} onCheckedChange={(v) => setEditing({ ...editing, active: v })} /> Can log in</label>
            </Field>
          </div>
        </FormDialog>
      )}
    </Panel>
  )
}

function PaymentMethodsTab() {
  const methods = useStore((s) => s.paymentMethods)
  const toggle = useStore((s) => s.togglePaymentMethod)
  return (
    <Panel title="Payment Methods" description="Methods available on sales, purchase and payment screens.">
      <ul className="divide-y rounded-md border">
        {methods.map((m) => (
          <li key={m.value} className="flex items-center justify-between px-4 py-3">
            <div>
              <div className="text-sm font-medium">{m.label}</div>
              <div className="text-xs text-muted-foreground">
                {m.value === "esewa" || m.value === "khalti" ? "Digital wallet — record transaction ID as reference" : m.value === "credit" ? "Sell / buy on credit, amount goes to party balance" : m.value === "bank" ? "Cheque, bank transfer, Fonepay QR" : m.value === "cash" ? "Cash in hand" : "Any other method"}
              </div>
            </div>
            <Switch
              checked={m.enabled}
              disabled={m.value === "cash"}
              onCheckedChange={() => {
                toggle(m.value)
                toast.success(`${m.label} ${m.enabled ? "disabled" : "enabled"}`)
              }}
            />
          </li>
        ))}
      </ul>
    </Panel>
  )
}

function ListTab({ kind }: { kind: "units" | "categories" }) {
  const list = useStore((s) => s[kind])
  const products = useStore((s) => s.products)
  const add = useStore((s) => (kind === "units" ? s.addUnit : s.addCategory))
  const remove = useStore((s) => (kind === "units" ? s.removeUnit : s.removeCategory))
  const [value, setValue] = useState("")
  const usage = (v: string) => products.filter((p) => (kind === "units" ? p.unit === v : p.category === v)).length
  const title = kind === "units" ? "Units" : "Categories"
  return (
    <Panel title={title} description={kind === "units" ? "Measurement units such as PCS, KG, LTR, BOX, METER, SET." : "Group products for filtering and reports."}>
      <form
        className="mb-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const v = kind === "units" ? value.trim().toUpperCase() : value.trim()
          if (!v) return
          if (list.includes(v)) return toast.error(`${v} already exists`)
          add(v)
          setValue("")
          toast.success(`${kind === "units" ? "Unit" : "Category"} added`)
        }}
      >
        <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={kind === "units" ? "e.g. DOZEN" : "e.g. Electrical"} className="h-9 max-w-xs" />
        <Button type="submit" className="h-9"><Plus /> Add</Button>
      </form>
      <div className="flex flex-wrap gap-2">
        {list.map((v) => {
          const n = usage(v)
          return (
            <span key={v} className={cn("inline-flex items-center gap-2 rounded-md border bg-card py-1 pr-1 pl-3 text-sm")}>
              {v}
              <span className="rounded bg-muted px-1.5 text-[11px] text-muted-foreground">{n}</span>
              <button
                type="button"
                className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
                disabled={n > 0}
                title={n > 0 ? "In use by products" : "Remove"}
                onClick={() => {
                  remove(v)
                  toast.success(`${v} removed`)
                }}
              >
                <Trash2 className="size-3.5" />
              </button>
            </span>
          )
        })}
      </div>
    </Panel>
  )
}
