"use client"

// Demo data store. Every action here maps 1:1 to what would become an API
// endpoint / database transaction in production.
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns"
import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import { computeTotals, round2, todayISO, uid } from "./format"
import { allocateFIFO, paidMap, stockMap } from "./ledger"
import { buildSeed, type DataState } from "./seed"
import type {
  AppUser, Bom, BusinessProfile, Expense, ID, Invoice, LineItem, Party, Payment, PaymentMethod,
  Product, Production, ProductionStatus, Purchase, StockMoveType,
} from "./types"

export const STORAGE_KEY = "abc-erp-demo-v6"

type Result<T = ID> = { ok: true; id: T } | { ok: false; error: string }

export interface SaleInput {
  date: string
  partyId: ID | null
  customerName?: string
  items: LineItem[]
  billDiscount: number
  paid: number
  method: PaymentMethod
  notes?: string
}

export interface PurchaseInput {
  date: string
  partyId: ID
  supplierBillNo: string
  items: LineItem[]
  billDiscount: number
  paid: number
  method: PaymentMethod
  notes?: string
}

export interface ProductionInput {
  date: string
  bomId: ID
  qty: number
  materials: { productId: ID; required: number; actual: number }[]
  overheadCost: number
  status: ProductionStatus
  notes?: string
}

interface Actions {
  resetDemo: () => void
  /** Shift all demo dates so the data always looks current (e.g. when opened days later) */
  rebaseDates: () => void
  addParty: (p: Omit<Party, "id" | "createdAt">) => ID
  updateParty: (id: ID, p: Partial<Party>) => void
  deleteParty: (id: ID) => Result<null>
  addProduct: (p: Omit<Product, "id" | "createdAt">) => ID
  updateProduct: (id: ID, p: Partial<Product>) => void
  deleteProduct: (id: ID) => Result<null>
  createSale: (input: SaleInput) => Result
  cancelInvoice: (id: ID) => void
  createPurchase: (input: PurchaseInput) => Result
  cancelPurchase: (id: ID) => Result<null>
  recordPayment: (p: Omit<Payment, "id" | "number">) => ID
  deletePayment: (id: ID) => void
  addExpense: (e: Omit<Expense, "id">) => ID
  updateExpense: (id: ID, e: Partial<Expense>) => void
  deleteExpense: (id: ID) => void
  stockEntry: (e: { date: string; productId: ID; type: "manual_in" | "manual_out" | "adjustment_in" | "adjustment_out"; qty: number; note?: string }) => Result
  saveBom: (b: Omit<Bom, "id"> & { id?: ID }) => ID
  deleteBom: (id: ID) => Result<null>
  createProduction: (input: ProductionInput) => Result
  setProductionStatus: (id: ID, status: ProductionStatus) => Result<null>
  updateBusiness: (b: Partial<BusinessProfile>) => void
  saveUser: (u: Omit<AppUser, "id"> & { id?: ID }) => void
  deleteUser: (id: ID) => void
  togglePaymentMethod: (v: PaymentMethod) => void
  addUnit: (u: string) => void
  removeUnit: (u: string) => void
  addCategory: (c: string) => void
  removeCategory: (c: string) => void
}

export type Store = DataState & { seeded: boolean } & Actions

const empty: DataState = {
  seededOn: "",
  business: {} as BusinessProfile,
  parties: [], products: [], categories: [], units: [], stockMovements: [], invoices: [], purchases: [],
  payments: [], expenses: [], boms: [], productions: [], users: [], paymentMethods: [],
}

export const useStore = create<Store>()(
  persist(
    (set, get) => {
      const nextNumber = (key: "nextInvoiceNo" | "nextPurchaseNo" | "nextPaymentNo" | "nextProductionNo") => {
        const n = get().business[key]
        set((s) => ({ business: { ...s.business, [key]: n + 1 } }))
        return n
      }
      const newPayment = (p: Omit<Payment, "id" | "number">): Payment => ({
        ...p, amount: round2(p.amount), id: uid("pay-"), number: `PMT-${nextNumber("nextPaymentNo")}`,
      })
      const move = (date: string, productId: ID, type: StockMoveType, qty: number, rate: number, reference: string, refId?: ID, note?: string) => ({
        id: uid("mv-"), date, productId, type, qty: round2(qty), rate, reference, refId, note,
      })
      const currentStock = () => stockMap(get().stockMovements)

      return {
        ...empty,
        seeded: false,

        resetDemo: () => set({ ...buildSeed(), seeded: true }),
        rebaseDates: () => {
          const s = get()
          const today = todayISO()
          if (!s.seededOn || s.seededOn === today) return
          const days = differenceInCalendarDays(parseISO(today), parseISO(s.seededOn))
          if (days <= 0) return
          const d = (x: string) => format(addDays(parseISO(x), days), "yyyy-MM-dd")
          const ts = (x: string) => addDays(new Date(x), days).toISOString()
          set({
            seededOn: today,
            parties: s.parties.map((p) => ({ ...p, createdAt: ts(p.createdAt) })),
            products: s.products.map((p) => ({ ...p, createdAt: ts(p.createdAt) })),
            stockMovements: s.stockMovements.map((m) => ({ ...m, date: d(m.date) })),
            invoices: s.invoices.map((i) => ({ ...i, date: d(i.date), createdAt: ts(i.createdAt) })),
            purchases: s.purchases.map((p) => ({ ...p, date: d(p.date), createdAt: ts(p.createdAt) })),
            payments: s.payments.map((p) => ({ ...p, date: d(p.date) })),
            expenses: s.expenses.map((e) => ({ ...e, date: d(e.date) })),
            productions: s.productions.map((p) => ({ ...p, date: d(p.date) })),
          })
        },

        // ---------- Parties ----------
        addParty: (p) => {
          const id = uid("pt-")
          set((s) => ({ parties: [{ ...p, id, createdAt: new Date().toISOString() }, ...s.parties] }))
          return id
        },
        updateParty: (id, p) => set((s) => ({ parties: s.parties.map((x) => (x.id === id ? { ...x, ...p } : x)) })),
        deleteParty: (id) => {
          const s = get()
          const used = s.invoices.some((i) => i.partyId === id) || s.purchases.some((i) => i.partyId === id) || s.payments.some((i) => i.partyId === id)
          if (used) return { ok: false, error: "This party has transactions. Mark it inactive instead." }
          set({ parties: s.parties.filter((p) => p.id !== id) })
          return { ok: true, id: null }
        },

        // ---------- Products ----------
        addProduct: (p) => {
          const id = uid("pr-")
          const date = todayISO()
          set((s) => ({
            products: [{ ...p, id, createdAt: new Date().toISOString() }, ...s.products],
            stockMovements: p.openingStock > 0
              ? [...s.stockMovements, move(date, id, "opening", p.openingStock, p.purchasePrice, "Opening Stock")]
              : s.stockMovements,
          }))
          return id
        },
        updateProduct: (id, p) => set((s) => ({ products: s.products.map((x) => (x.id === id ? { ...x, ...p } : x)) })),
        deleteProduct: (id) => {
          const s = get()
          const used = s.stockMovements.some((m) => m.productId === id && m.type !== "opening") || s.boms.some((b) => b.productId === id || b.items.some((i) => i.productId === id))
          if (used) return { ok: false, error: "This product has transactions or is used in a BOM. Mark it inactive instead." }
          set({ products: s.products.filter((p) => p.id !== id), stockMovements: s.stockMovements.filter((m) => m.productId !== id) })
          return { ok: true, id: null }
        },

        // ---------- Sales ----------
        createSale: (input) => {
          const s = get()
          if (!input.items.length) return { ok: false, error: "Add at least one product." }
          const stock = currentStock()
          const need: Record<ID, number> = {}
          input.items.forEach((it) => (need[it.productId] = (need[it.productId] ?? 0) + it.qty))
          for (const [pid, q] of Object.entries(need)) {
            if ((stock[pid] ?? 0) < q) {
              const p = s.products.find((x) => x.id === pid)
              return { ok: false, error: `Not enough stock for ${p?.name}. Available: ${stock[pid] ?? 0} ${p?.unit}` }
            }
          }
          const t = computeTotals(input.items, input.billDiscount)
          const paid = Math.min(round2(input.paid), t.total)
          if (!input.partyId && paid < t.total) return { ok: false, error: "Walk-in customers must pay in full. Select a party to sell on credit." }
          const id = uid("inv-")
          const number = `${s.business.invoicePrefix}${nextNumber("nextInvoiceNo")}`
          const party = s.parties.find((p) => p.id === input.partyId)
          const invoice: Invoice = {
            id, number, date: input.date, partyId: input.partyId, customerName: party?.name ?? input.customerName ?? "Cash Sale (Walk-in)",
            items: input.items, billDiscount: input.billDiscount, notes: input.notes, cancelled: false, createdAt: new Date().toISOString(), ...t,
          }
          const byId = Object.fromEntries(s.products.map((p) => [p.id, p]))
          const moves = input.items.map((it) => move(input.date, it.productId, "sale", -it.qty, byId[it.productId]?.purchasePrice ?? 0, number, id))
          const pay = paid > 0 ? [newPayment({ date: input.date, partyId: input.partyId, direction: "in", amount: paid, method: input.method === "credit" ? "cash" : input.method, invoiceId: id, reference: number, notes: "Received at time of sale" })] : []
          set((st) => ({ invoices: [...st.invoices, invoice], stockMovements: [...st.stockMovements, ...moves], payments: [...st.payments, ...pay] }))
          return { ok: true, id }
        },
        cancelInvoice: (id) => {
          const s = get()
          const inv = s.invoices.find((i) => i.id === id)
          if (!inv || inv.cancelled) return
          const moves = inv.items.map((it) => move(todayISO(), it.productId, "sale_return", it.qty, 0, inv.number, id, "Invoice cancelled"))
          set({
            invoices: s.invoices.map((i) => (i.id === id ? { ...i, cancelled: true } : i)),
            stockMovements: [...s.stockMovements, ...moves],
            // amounts received against a cancelled invoice are treated as refunded
            payments: s.payments.filter((p) => p.invoiceId !== id),
          })
        },

        // ---------- Purchases ----------
        createPurchase: (input) => {
          const s = get()
          if (!input.items.length) return { ok: false, error: "Add at least one product." }
          const t = computeTotals(input.items, input.billDiscount)
          const paid = Math.min(round2(input.paid), t.total)
          const id = uid("pur-")
          const number = `${s.business.purchasePrefix}${nextNumber("nextPurchaseNo")}`
          const purchase: Purchase = {
            id, number, date: input.date, partyId: input.partyId, supplierBillNo: input.supplierBillNo, items: input.items,
            billDiscount: input.billDiscount, notes: input.notes, cancelled: false, createdAt: new Date().toISOString(), ...t,
          }
          const moves = input.items.map((it) => move(input.date, it.productId, "purchase", it.qty, it.rate, number, id))
          const pay = paid > 0 ? [newPayment({ date: input.date, partyId: input.partyId, direction: "out", amount: paid, method: input.method === "credit" ? "cash" : input.method, purchaseId: id, reference: number, notes: "Paid against purchase bill" })] : []
          const newRates = Object.fromEntries(input.items.map((it) => [it.productId, it.rate]))
          set((st) => ({
            purchases: [...st.purchases, purchase],
            stockMovements: [...st.stockMovements, ...moves],
            payments: [...st.payments, ...pay],
            products: st.products.map((p) => (newRates[p.id] ? { ...p, purchasePrice: newRates[p.id] } : p)),
          }))
          return { ok: true, id }
        },
        cancelPurchase: (id) => {
          const s = get()
          const pur = s.purchases.find((p) => p.id === id)
          if (!pur || pur.cancelled) return { ok: true, id: null }
          const stock = currentStock()
          const short = pur.items.find((it) => (stock[it.productId] ?? 0) < it.qty)
          if (short) return { ok: false, error: `Cannot cancel — ${short.name} has already been used or sold.` }
          const moves = pur.items.map((it) => move(todayISO(), it.productId, "manual_out", -it.qty, it.rate, pur.number, id, "Purchase cancelled"))
          set({
            purchases: s.purchases.map((p) => (p.id === id ? { ...p, cancelled: true } : p)),
            stockMovements: [...s.stockMovements, ...moves],
            payments: s.payments.filter((p) => p.purchaseId !== id),
          })
          return { ok: true, id: null }
        },

        // ---------- Payments ----------
        recordPayment: (p) => {
          const s = get()
          let allocations: Payment["allocations"]
          if (p.partyId && !p.invoiceId && !p.purchaseId) {
            const docs = p.direction === "in"
              ? s.invoices.filter((i) => i.partyId === p.partyId && !i.cancelled)
              : s.purchases.filter((x) => x.partyId === p.partyId && !x.cancelled)
            allocations = allocateFIFO(docs, paidMap(s.payments), p.amount)
          }
          const pay = newPayment({ ...p, allocations })
          set((s) => ({ payments: [...s.payments, pay] }))
          return pay.id
        },
        deletePayment: (id) => set((s) => ({ payments: s.payments.filter((p) => p.id !== id) })),

        // ---------- Expenses ----------
        addExpense: (e) => {
          const id = uid("exp-")
          set((s) => ({ expenses: [...s.expenses, { ...e, id }] }))
          return id
        },
        updateExpense: (id, e) => set((s) => ({ expenses: s.expenses.map((x) => (x.id === id ? { ...x, ...e } : x)) })),
        deleteExpense: (id) => set((s) => ({ expenses: s.expenses.filter((x) => x.id !== id) })),

        // ---------- Stock ----------
        stockEntry: (e) => {
          const s = get()
          const p = s.products.find((x) => x.id === e.productId)
          if (!p) return { ok: false, error: "Select a product." }
          const out = e.type.endsWith("_out")
          if (out && (currentStock()[e.productId] ?? 0) < e.qty) return { ok: false, error: `Only ${currentStock()[e.productId] ?? 0} ${p.unit} in stock.` }
          const ref = e.type.startsWith("adjustment") ? "Stock Adjustment" : out ? "Manual Stock Out" : "Manual Stock In"
          const mv = move(e.date, e.productId, e.type, out ? -e.qty : e.qty, p.purchasePrice, ref, undefined, e.note)
          set({ stockMovements: [...s.stockMovements, mv] })
          return { ok: true, id: mv.id }
        },

        // ---------- Manufacturing ----------
        saveBom: (b) => {
          const id = b.id ?? uid("bom-")
          set((s) => ({
            boms: b.id ? s.boms.map((x) => (x.id === b.id ? ({ ...b, id } as Bom) : x)) : [...s.boms, { ...b, id } as Bom],
          }))
          return id
        },
        deleteBom: (id) => {
          const s = get()
          if (s.productions.some((p) => p.bomId === id && p.status !== "cancelled")) return { ok: false, error: "This BOM is used by production entries." }
          set({ boms: s.boms.filter((b) => b.id !== id) })
          return { ok: true, id: null }
        },
        createProduction: (input) => {
          const s = get()
          const bom = s.boms.find((b) => b.id === input.bomId)
          if (!bom) return { ok: false, error: "Select a Bill of Materials." }
          if (input.qty <= 0) return { ok: false, error: "Enter production quantity." }
          const byId = Object.fromEntries(s.products.map((p) => [p.id, p]))
          const materials = input.materials.map((m) => ({ ...m, rate: byId[m.productId]?.purchasePrice ?? 0 }))
          const materialCost = round2(materials.reduce((a, m) => a + m.actual * m.rate, 0))
          const id = uid("prd-")
          const production: Production = {
            id, number: `PRD-${nextNumber("nextProductionNo")}`, date: input.date, productId: bom.productId, bomId: bom.id,
            qty: input.qty, materials, overheadCost: round2(input.overheadCost), materialCost,
            totalCost: round2(materialCost + input.overheadCost), status: "draft", notes: input.notes,
          }
          set((st) => ({ productions: [...st.productions, production] }))
          if (input.status !== "draft") {
            const r = get().setProductionStatus(id, input.status)
            if (!r.ok) {
              set((st) => ({ productions: st.productions.filter((p) => p.id !== id) }))
              return r
            }
          }
          return { ok: true, id }
        },
        setProductionStatus: (id, status) => {
          const s = get()
          const prd = s.productions.find((p) => p.id === id)
          if (!prd) return { ok: false, error: "Production not found." }
          if (prd.status === "completed" || prd.status === "cancelled") return { ok: false, error: `Production is already ${prd.status}.` }
          if (status === "completed") {
            const stock = stockMap(s.stockMovements)
            const byId = Object.fromEntries(s.products.map((p) => [p.id, p]))
            const short = prd.materials.find((m) => (stock[m.productId] ?? 0) < m.actual)
            if (short) {
              const p = byId[short.productId]
              return { ok: false, error: `Not enough ${p?.name}. Need ${short.actual} ${p?.unit}, have ${stock[short.productId] ?? 0}.` }
            }
            const date = todayISO() > prd.date ? prd.date : todayISO()
            // re-price materials at current cost when the batch is completed
            const materials = prd.materials.map((m) => ({ ...m, rate: byId[m.productId]?.purchasePrice ?? m.rate }))
            const materialCost = round2(materials.reduce((a, m) => a + m.actual * m.rate, 0))
            const totalCost = round2(materialCost + prd.overheadCost)
            const unitCost = round2(totalCost / prd.qty)
            const moves = [
              ...materials.map((m) => move(date, m.productId, "production_out", -m.actual, m.rate, prd.number, id)),
              move(date, prd.productId, "production_in", prd.qty, unitCost, prd.number, id),
            ]
            set({
              productions: s.productions.map((p) => (p.id === id ? { ...p, status, materials, materialCost, totalCost } : p)),
              stockMovements: [...s.stockMovements, ...moves],
              products: s.products.map((p) => (p.id === prd.productId ? { ...p, purchasePrice: unitCost } : p)),
            })
            return { ok: true, id: null }
          }
          set({ productions: s.productions.map((p) => (p.id === id ? { ...p, status } : p)) })
          return { ok: true, id: null }
        },

        // ---------- Settings ----------
        updateBusiness: (b) => set((s) => ({ business: { ...s.business, ...b } })),
        saveUser: (u) =>
          set((s) => ({
            users: u.id ? s.users.map((x) => (x.id === u.id ? ({ ...x, ...u } as AppUser) : x)) : [...s.users, { ...u, id: uid("u-") }],
          })),
        deleteUser: (id) => set((s) => ({ users: s.users.filter((u) => u.id !== id) })),
        togglePaymentMethod: (v) =>
          set((s) => ({ paymentMethods: s.paymentMethods.map((m) => (m.value === v ? { ...m, enabled: !m.enabled } : m)) })),
        addUnit: (u) => set((s) => ({ units: s.units.includes(u) ? s.units : [...s.units, u] })),
        removeUnit: (u) => set((s) => ({ units: s.units.filter((x) => x !== u) })),
        addCategory: (c) => set((s) => ({ categories: s.categories.includes(c) ? s.categories : [...s.categories, c] })),
        removeCategory: (c) => set((s) => ({ categories: s.categories.filter((x) => x !== c) })),
      }
    },
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      // persist data only, not actions
      partialize: (s) => Object.fromEntries(Object.entries(s).filter(([, v]) => typeof v !== "function")) as Partial<Store>,
    },
  ),
)
