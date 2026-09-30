import { format, getDay, subDays } from "date-fns"
import { computeTotals, round2 } from "./format"
import { allocateFIFO } from "./ledger"
import type {
  AppUser,
  Bom,
  BusinessProfile,
  Expense,
  ExpenseCategory,
  ID,
  Invoice,
  LineItem,
  Party,
  Payment,
  PaymentMethod,
  Product,
  Production,
  Purchase,
  StockMovement,
  StockMoveType,
} from "./types"

export interface DataState {
  /** Date the demo data is anchored to; used to keep "today" current */
  seededOn: string
  business: BusinessProfile
  parties: Party[]
  products: Product[]
  categories: string[]
  units: string[]
  stockMovements: StockMovement[]
  invoices: Invoice[]
  purchases: Purchase[]
  payments: Payment[]
  expenses: Expense[]
  boms: Bom[]
  productions: Production[]
  users: AppUser[]
  paymentMethods: { value: PaymentMethod; label: string; enabled: boolean }[]
}

/** Deterministic PRNG so the demo looks the same every time it is reset */
function mulberry32(a: number) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const HISTORY_DAYS = 100

export function buildSeed(): DataState {
  const rnd = mulberry32(2083)
  const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)]
  const between = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1))
  const roundTo = (n: number, step: number) => Math.max(step, Math.round(n / step) * step)

  const today = new Date()
  const D = (daysAgo: number) => format(subDays(today, daysAgo), "yyyy-MM-dd")
  const TS = (daysAgo: number, hour = 10) => {
    const d = subDays(today, daysAgo)
    d.setHours(hour, between(0, 59), 0, 0)
    return d.toISOString()
  }

  const business: BusinessProfile = {
    name: "ABC Manufacturing & Trading Pvt. Ltd.",
    address: "Balaju Industrial Area, Kathmandu-16, Nepal",
    phone: "01-4351234, 9851012345",
    email: "info@abcmanufacturing.com.np",
    pan: "606123456",
    logoText: "ABC",
    invoicePrefix: "INV-",
    purchasePrefix: "PUR-",
    nextInvoiceNo: 1001,
    nextPurchaseNo: 501,
    nextPaymentNo: 3001,
    nextProductionNo: 101,
    defaultVat: 13,
    vatRegistered: true,
    invoiceFooter: "Goods once sold will not be taken back. Thank you for your business!",
    bankDetails: "Nabil Bank Ltd., Balaju Branch — A/C 0101017501234",
  }

  // ---------------- Parties ----------------
  const P = (
    id: string, name: string, type: Party["type"], phone: string, address: string,
    pan: string, openingBalance: number, creditLimit: number,
  ): Party => ({
    id, name, type, phone, address, pan, openingBalance, creditLimit,
    email: `${name.split(" ")[0].toLowerCase()}@gmail.com`,
    status: "active", createdAt: TS(HISTORY_DAYS + 20),
  })

  const parties: Party[] = [
    P("pt-everest", "Everest Hardware Store", "customer", "9841234567", "New Road, Kathmandu", "301245678", 45000, 300000),
    P("pt-ktmtraders", "Kathmandu Traders", "customer", "9851098765", "Kalimati, Kathmandu", "302334455", 28000, 250000),
    P("pt-sunrise", "Sunrise Construction", "customer", "9801122334", "Jawalakhel, Lalitpur", "604556677", 60000, 500000),
    P("pt-ganesh", "Shree Ganesh Enterprises", "both", "9843345566", "Suryabinayak, Bhaktapur", "305667788", 12000, 200000),
    P("pt-pokhara", "Pokhara Build Mart", "customer", "9856021234", "Chipledhunga, Pokhara", "401223344", 0, 200000),
    P("pt-namaste", "Namaste Tiles & Sanitary", "customer", "9818765432", "Chabahil, Kathmandu", "303889900", 15000, 150000),
    P("pt-lumbini", "Lumbini Nirman Sewa", "customer", "9857034567", "Traffic Chowk, Butwal", "501112233", 0, 250000),
    P("pt-bhattarai", "Bhattarai Hardware & Suppliers", "customer", "9845067890", "Narayangadh, Chitwan", "502998877", 8000, 150000),
    P("pt-himalayan", "Himalayan Suppliers Pvt. Ltd.", "supplier", "01-4256789", "Teku, Kathmandu", "600112233", -85000, 0),
    P("pt-bagmati", "Bagmati Steel Traders", "supplier", "01-5543210", "Birgunj, Parsa", "600445566", -40000, 0),
    P("pt-packaging", "Nepal Packaging Udhyog", "supplier", "9851076543", "Hetauda Industrial Area, Makwanpur", "600778899", -12000, 0),
    P("pt-chemtech", "Chemtech Nepal Pvt. Ltd.", "supplier", "01-4478901", "Sinamangal, Kathmandu", "601234987", 0, 0),
  ]

  // ---------------- Products ----------------
  const PR = (
    id: string, name: string, sku: string, category: string, unit: Product["unit"], kind: Product["kind"],
    purchasePrice: number, sellingPrice: number, openingStock: number, minStock: number,
  ): Product => ({
    id, name, sku, category, unit, kind, purchasePrice, sellingPrice, openingStock, minStock,
    barcode: "890" + String(Math.floor(1e9 + rnd() * 9e9)),
    vatRate: 13, status: "active", createdAt: TS(HISTORY_DAYS + 20),
  })

  const products: Product[] = [
    PR("pr-cement", "Cement OPC 50kg", "RM-CEM-001", "Construction Material", "BAG", "raw", 780, 850, 650, 150),
    PR("pr-steel", "Steel Rod 12mm (TMT)", "TR-STL-012", "Steel", "KG", "trading", 102, 115, 6000, 1500),
    PR("pr-sand", "River Sand (Fine)", "RM-SND-001", "Construction Material", "KG", "raw", 2.5, 3.2, 22000, 5000),
    PR("pr-polymer", "Raw Material A — Polymer Additive", "RM-PLA-001", "Chemicals", "KG", "raw", 420, 480, 260, 250),
    PR("pr-bag", "Packaging Bag 20kg (HDPE)", "PK-BAG-020", "Packaging", "PCS", "raw", 18, 22, 1400, 300),
    PR("pr-box", "Packaging Box (Carton)", "PK-BOX-001", "Packaging", "PCS", "raw", 35, 45, 450, 100),
    PR("pr-adhesive", "Finished Product A — Tile Adhesive 20kg", "FG-A-001", "Finished Goods", "BAG", "finished", 425, 850, 180, 60),
    PR("pr-grout", "Finished Product B — Tile Grout (Box of 10)", "FG-B-001", "Finished Goods", "BOX", "finished", 300, 650, 90, 30),
    PR("pr-pipe", "PVC Pipe 1 inch", "TR-PVC-001", "Plumbing", "METER", "trading", 95, 120, 900, 300),
    PR("pr-hinge", "Door Hinge Set (SS)", "TR-HNG-001", "Hardware", "SET", "trading", 180, 250, 260, 220),
    PR("pr-paint", "Exterior Emulsion Paint", "TR-PNT-001", "Paints", "LTR", "trading", 520, 650, 380, 350),
    PR("pr-wire", "Binding Wire", "TR-WIR-001", "Steel", "KG", "trading", 140, 165, 450, 100),
    PR("pr-spacer", "Tile Spacer 3mm (Pack of 100)", "TR-SPC-003", "Hardware", "PCS", "trading", 55, 90, 25, 20),
  ]
  const prod = (id: ID) => products.find((p) => p.id === id)!

  // ---------------- BOMs ----------------
  const boms: Bom[] = [
    {
      id: "bom-a", productId: "pr-adhesive", name: "Tile Adhesive — Standard Mix", outputQty: 1,
      items: [
        { productId: "pr-cement", qty: 0.2 },
        { productId: "pr-sand", qty: 9 },
        { productId: "pr-polymer", qty: 0.4 },
        { productId: "pr-bag", qty: 1 },
      ],
      overheadCost: 60, notes: "Mix 12 minutes. Pack in 20kg HDPE bags.",
    },
    {
      id: "bom-b", productId: "pr-grout", name: "Tile Grout — Box of 10 × 1kg", outputQty: 1,
      items: [
        { productId: "pr-cement", qty: 0.1 },
        { productId: "pr-sand", qty: 4 },
        { productId: "pr-polymer", qty: 0.3 },
        { productId: "pr-box", qty: 1 },
      ],
      overheadCost: 50, notes: "Fine sieve sand before mixing.",
    },
  ]

  // ---------------- Simulation ----------------
  const stock: Record<ID, number> = {}
  const cost: Record<ID, number> = {}
  const bal: Record<ID, number> = {}
  const stockMovements: StockMovement[] = []
  const invoices: Invoice[] = []
  const purchases: Purchase[] = []
  const payments: Payment[] = []
  const expenses: Expense[] = []
  const productions: Production[] = []

  parties.forEach((p) => (bal[p.id] = p.openingBalance))
  let mvSeq = 1
  const move = (date: string, productId: ID, type: StockMoveType, q: number, rate: number, reference: string, refId?: ID, note?: string) => {
    stock[productId] = round2((stock[productId] ?? 0) + q)
    stockMovements.push({ id: `mv-${mvSeq++}`, date, productId, type, qty: q, rate, reference, refId, note })
  }
  products.forEach((p) => {
    cost[p.id] = p.purchasePrice
    move(D(HISTORY_DAYS + 5), p.id, "opening", p.openingStock, p.purchasePrice, "Opening Stock")
  })

  const nextPayment = () => `PMT-${business.nextPaymentNo++}`
  const line = (productId: ID, q: number, rate: number, discount = 0): LineItem => {
    const p = prod(productId)
    return { productId, name: p.name, unit: p.unit, qty: q, rate, discount, vatRate: p.vatRate }
  }

  const docPaid: Record<ID, number> = {}
  const addPayment = (p: Omit<Payment, "id" | "number">) => {
    const id = `pay-${payments.length + 1}`
    const direct = p.invoiceId ?? p.purchaseId
    let allocations: Payment["allocations"]
    if (direct) docPaid[direct] = (docPaid[direct] ?? 0) + p.amount
    else if (p.partyId) {
      const docs = p.direction === "in" ? invoices.filter((i) => i.partyId === p.partyId) : purchases.filter((x) => x.partyId === p.partyId)
      allocations = allocateFIFO(docs, docPaid, p.amount)
      allocations.forEach((a) => (docPaid[a.docId] = (docPaid[a.docId] ?? 0) + a.amount))
    }
    payments.push({ ...p, id, number: nextPayment(), allocations })
    if (p.partyId) bal[p.partyId] += p.direction === "in" ? -p.amount : p.amount
  }

  const makeInvoice = (daysAgo: number, partyId: ID | null, items: LineItem[], paidRatio: number, method: PaymentMethod, billDiscount = 0) => {
    const t = computeTotals(items, billDiscount)
    const id = `inv-${invoices.length + 1}`
    const number = `${business.invoicePrefix}${business.nextInvoiceNo++}`
    const date = D(daysAgo)
    const party = partyId ? parties.find((p) => p.id === partyId)! : null
    invoices.push({
      id, number, date, partyId, customerName: party?.name ?? "Cash Sale (Walk-in)",
      items, billDiscount, cancelled: false, createdAt: TS(daysAgo, between(9, 17)), ...t,
    })
    items.forEach((it) => move(date, it.productId, "sale", -it.qty, cost[it.productId], number, id))
    if (partyId) bal[partyId] += t.total
    const paid = !partyId || paidRatio >= 1 ? t.total : paidRatio > 0 ? round2(roundTo(t.total * paidRatio, 100)) : 0
    const amount = Math.min(paid, t.total)
    if (amount > 0) addPayment({ date, partyId, direction: "in", amount, method: method === "credit" ? "cash" : method, invoiceId: id, reference: number, notes: "Received at time of sale" })
    return id
  }

  const makePurchase = (daysAgo: number, partyId: ID, items: LineItem[], paidRatio: number, method: PaymentMethod) => {
    const t = computeTotals(items)
    const id = `pur-${purchases.length + 1}`
    const number = `${business.purchasePrefix}${business.nextPurchaseNo++}`
    const date = D(daysAgo)
    purchases.push({
      id, number, date, partyId, supplierBillNo: String(between(1200, 9800)), items, billDiscount: 0,
      cancelled: false, createdAt: TS(daysAgo, between(9, 17)), ...t,
    })
    items.forEach((it) => {
      move(date, it.productId, "purchase", it.qty, it.rate, number, id)
      cost[it.productId] = it.rate
    })
    bal[partyId] -= t.total
    const amount = paidRatio >= 1 ? t.total : round2(Math.min(t.total, roundTo(t.total * paidRatio, 100)))
    if (amount > 0 && paidRatio > 0) addPayment({ date, partyId, direction: "out", amount, method, purchaseId: id, reference: number, notes: "Paid against purchase bill" })
  }

  const makeProduction = (daysAgo: number, bomId: ID, q: number, status: Production["status"]) => {
    const bom = boms.find((b) => b.id === bomId)!
    const batches = q / bom.outputQty
    const materials = bom.items.map((it) => {
      const required = round2(it.qty * batches)
      const unit = prod(it.productId).unit
      const discrete = unit === "BAG" || unit === "PCS" || unit === "BOX"
      // small real-world wastage variance on loose materials only
      const actual = status === "draft" || discrete ? required : round2(required * (1 + (rnd() - 0.4) * 0.03))
      return { productId: it.productId, required, actual, rate: cost[it.productId] }
    })
    const materialCost = round2(materials.reduce((s, m) => s + m.actual * m.rate, 0))
    const overheadCost = round2(bom.overheadCost * batches)
    const id = `prd-${productions.length + 1}`
    const number = `PRD-${business.nextProductionNo++}`
    const date = D(daysAgo)
    productions.push({
      id, number, date, productId: bom.productId, bomId, qty: q, materials, overheadCost, materialCost,
      totalCost: materialCost + overheadCost, status,
      notes: status === "in_progress" ? "Batch mixing in progress — Line 2" : status === "draft" ? "Planned for next shift" : undefined,
    })
    if (status === "completed") {
      materials.forEach((m) => move(date, m.productId, "production_out", -m.actual, m.rate, number, id))
      const unitCost = round2((materialCost + overheadCost) / q)
      move(date, bom.productId, "production_in", q, unitCost, number, id)
      cost[bom.productId] = unitCost
    }
  }

  const canProduce = (bomId: ID, q: number) => {
    const bom = boms.find((b) => b.id === bomId)!
    return bom.items.every((it) => (stock[it.productId] ?? 0) >= it.qty * q * 1.02)
  }

  const customers = parties.filter((p) => p.type !== "supplier").map((p) => p.id)
  const sellable: { id: ID; min: number; max: number; step: number; w: number }[] = [
    { id: "pr-cement", min: 20, max: 120, step: 5, w: 5 },
    { id: "pr-steel", min: 150, max: 900, step: 50, w: 4 },
    { id: "pr-sand", min: 500, max: 3000, step: 250, w: 2 },
    { id: "pr-adhesive", min: 10, max: 50, step: 5, w: 4 },
    { id: "pr-grout", min: 5, max: 25, step: 5, w: 3 },
    { id: "pr-pipe", min: 20, max: 120, step: 10, w: 2 },
    { id: "pr-hinge", min: 5, max: 30, step: 5, w: 2 },
    { id: "pr-paint", min: 8, max: 40, step: 4, w: 2 },
    { id: "pr-wire", min: 10, max: 40, step: 5, w: 2 },
  ]
  const weighted = sellable.flatMap((s) => Array(s.w).fill(s))

  const reorder: { id: ID; supplier: ID; below: number; buy: number; step: number }[] = [
    { id: "pr-cement", supplier: "pt-himalayan", below: 300, buy: 500, step: 50 },
    { id: "pr-sand", supplier: "pt-himalayan", below: 9000, buy: 15000, step: 1000 },
    { id: "pr-steel", supplier: "pt-bagmati", below: 2500, buy: 5000, step: 500 },
    { id: "pr-wire", supplier: "pt-bagmati", below: 150, buy: 350, step: 50 },
    { id: "pr-bag", supplier: "pt-packaging", below: 500, buy: 1200, step: 100 },
    { id: "pr-box", supplier: "pt-packaging", below: 200, buy: 400, step: 50 },
    { id: "pr-polymer", supplier: "pt-chemtech", below: 120, buy: 250, step: 25 },
    { id: "pr-paint", supplier: "pt-chemtech", below: 150, buy: 300, step: 20 },
    { id: "pr-pipe", supplier: "pt-ganesh", below: 300, buy: 600, step: 50 },
    { id: "pr-hinge", supplier: "pt-ganesh", below: 100, buy: 200, step: 20 },
  ]
  const methods: PaymentMethod[] = ["cash", "cash", "bank", "bank", "esewa", "khalti"]

  for (let day = HISTORY_DAYS; day >= 1; day--) {
    const date = subDays(today, day)
    if (getDay(date) === 6) continue // Saturday — weekly holiday in Nepal

    // Purchases — restock whatever has dropped below reorder level (skip some items near the end so low-stock alerts show)
    const bySupplier: Record<ID, LineItem[]> = {}
    for (const r of reorder) {
      if (day < 18 && (r.id === "pr-hinge" || r.id === "pr-polymer" || r.id === "pr-box")) continue
      if ((stock[r.id] ?? 0) < r.below) {
        const p = prod(r.id)
        const rate = round2(p.purchasePrice * (0.97 + rnd() * 0.06))
        ;(bySupplier[r.supplier] ??= []).push(line(r.id, roundTo(r.buy * (0.9 + rnd() * 0.3), r.step), rate))
      }
    }
    for (const [sup, items] of Object.entries(bySupplier)) {
      const ratio = pick([1, 1, 0.5, 0.6, 0, 0.4])
      makePurchase(day, sup, items, ratio, pick(["bank", "bank", "cash"]))
    }

    // Production — alternate products every few days
    if (day % 4 === 0) {
      const bomId = day % 8 === 0 ? "bom-a" : "bom-b"
      const q = bomId === "bom-a" ? between(10, 16) * 10 : between(3, 5) * 10
      if (canProduce(bomId, q)) makeProduction(day, bomId, q, "completed")
    }

    // Sales
    const nSales = between(1, 3)
    for (let i = 0; i < nSales; i++) {
      const walkIn = rnd() < 0.2
      const partyId = walkIn ? null : pick(customers)
      const nItems = walkIn ? 1 : between(1, 3)
      const items: LineItem[] = []
      const used = new Set<ID>()
      for (let k = 0; k < nItems; k++) {
        const s = pick(weighted)
        if (used.has(s.id)) continue
        used.add(s.id)
        let q = roundTo(between(s.min, s.max) * (walkIn ? 0.3 : 1), s.step)
        q = Math.min(q, Math.floor((stock[s.id] ?? 0) * 0.5 / s.step) * s.step)
        if (q <= 0) continue
        const p = prod(s.id)
        const disc = !walkIn && rnd() < 0.25 ? roundTo(q * p.sellingPrice * 0.02, 50) : 0
        items.push(line(s.id, q, p.sellingPrice, disc))
      }
      if (!items.length) continue
      const r = rnd()
      const [ratio, method]: [number, PaymentMethod] =
        r < 0.45 ? [1, pick(methods)] : r < 0.7 ? [pick([0.3, 0.5, 0.6]), pick(methods)] : [0, "credit"]
      makeInvoice(day, partyId, items, ratio, method)
    }

    // Customers paying off dues
    for (const c of customers) {
      if (bal[c] > 40000 && rnd() < 0.12) {
        const amt = roundTo(bal[c] * (0.3 + rnd() * 0.5), 1000)
        addPayment({ date: D(day), partyId: c, direction: "in", amount: amt, method: pick(["bank", "bank", "cash", "esewa"]), reference: `CHQ-${between(100000, 999999)}`, notes: "Payment against outstanding balance" })
      }
    }
    // Paying suppliers
    for (const s of parties.filter((p) => p.type !== "customer").map((p) => p.id)) {
      if (bal[s] < -60000 && rnd() < 0.15) {
        const amt = roundTo(-bal[s] * (0.3 + rnd() * 0.4), 1000)
        addPayment({ date: D(day), partyId: s, direction: "out", amount: amt, method: "bank", reference: `NIBL-${between(10000, 99999)}`, notes: "Supplier settlement" })
      }
    }

  }

  // Running expenses — every calendar day including today and Saturdays
  for (let day = HISTORY_DAYS; day >= 0; day--) {
    const date = subDays(today, day)
    const dom = date.getDate()
    const exp = (category: ExpenseCategory, amount: number, description: string, method: PaymentMethod = "cash", paidTo?: string) =>
      expenses.push({ id: `exp-${expenses.length + 1}`, date: D(day), category, amount, description, method, paidTo })
    if (dom === 1) {
      exp("Rent", 45000, "Monthly factory & godown rent", "bank", "Shrestha Properties")
      exp("Salary", 185000, "Staff salary (9 employees)", "bank")
    }
    if (dom === 5) exp("Electricity", between(9, 15) * 1000, "NEA electricity bill — factory", "esewa", "Nepal Electricity Authority")
    if (dom === 8) exp("Office", between(2, 6) * 500, "Internet & telephone", "khalti", "WorldLink")
    if (getDay(date) === 3) exp("Transport", between(3, 9) * 500, "Delivery vehicle fuel & loading", "cash")
    if (dom === 15 && rnd() < 0.7) exp("Marketing", between(5, 15) * 1000, "Facebook ads & hoarding board", "bank")
    if (dom === 20 && rnd() < 0.6) exp("Maintenance", between(3, 12) * 1000, "Mixer machine servicing", "cash", "Sagar Engineering Works")
    if (rnd() < 0.08) exp("Other", between(1, 5) * 500, "Tea, snacks & miscellaneous", "cash")
  }

  makeInvoice(2, "pt-lumbini", [line("pr-spacer", 25, 90)], 1, "khalti")

  // ---------------- Today (hand-crafted so the dashboard tells a good story) ----------------
  {
    makeInvoice(0, "pt-sunrise", [line("pr-cement", 100, 850, 1700), line("pr-steel", 560, 115)], 0.5, "bank")
    makeInvoice(0, "pt-everest", [line("pr-adhesive", 40, 850), line("pr-grout", 15, 650)], 1, "esewa")
    makeInvoice(0, "pt-namaste", [line("pr-paint", 20, 650), line("pr-pipe", 60, 120)], 0, "credit")
    makeInvoice(0, null, [line("pr-hinge", 10, 250), line("pr-wire", 12, 165)], 1, "cash")
    makePurchase(0, "pt-himalayan", [line("pr-cement", 150, 785), line("pr-sand", 5000, 2.5)], 0.5, "bank")
    makePurchase(0, "pt-bagmati", [line("pr-steel", 300, 103)], 0, "credit")
    makeProduction(1, "bom-a", 80, "in_progress")
    makeProduction(0, "bom-b", 40, "draft")
    expenses.push({ id: `exp-${expenses.length + 1}`, date: D(0), category: "Transport", amount: 3500, description: "Delivery to Sunrise Construction site", method: "cash", paidTo: "Ram Truck Sewa" })
  }

  // Tune opening balances so headline receivable/payable match the pitch numbers
  const tune = (target: number, sign: 1 | -1) => {
    const ids = parties.filter((p) => sign * bal[p.id] > 0).map((p) => p.id)
    let diff = target - ids.reduce((s, id) => s + sign * bal[id], 0)
    for (const id of ids.sort((a, b) => sign * bal[b] - sign * bal[a])) {
      if (Math.abs(diff) < 0.01) break
      // never push a party below NPR 8,000 outstanding
      const change = Math.max(diff, -(sign * bal[id] - 8000))
      if (change < 0) {
        // settle part of the balance with a recent payment
        addPayment({ date: D(4), partyId: id, direction: sign === 1 ? "in" : "out", amount: round2(-change), method: "bank", reference: `NIBL-${between(10000, 99999)}`, notes: "Part settlement of outstanding balance" })
      } else {
        const party = parties.find((p) => p.id === id)!
        party.openingBalance = round2(party.openingBalance + sign * change)
        bal[id] += sign * change
      }
      diff -= change
    }
  }
  tune(485000, 1)
  tune(235000, -1)

  // Current cost price reflects the latest purchase / production cost
  products.forEach((p) => (p.purchasePrice = round2(cost[p.id])))

  // Chronological order
  stockMovements.sort((a, b) => a.date.localeCompare(b.date))

  return {
    seededOn: format(today, "yyyy-MM-dd"),
    business,
    parties,
    products,
    categories: ["Construction Material", "Steel", "Chemicals", "Packaging", "Finished Goods", "Plumbing", "Hardware", "Paints"],
    units: ["PCS", "KG", "LTR", "BOX", "METER", "SET", "BAG", "TON"],
    stockMovements,
    invoices,
    purchases,
    payments,
    expenses,
    boms,
    productions,
    users: [
      { id: "u-1", name: "Rajesh Shrestha", email: "rajesh@abcmanufacturing.com.np", phone: "9851012345", role: "Admin", active: true },
      { id: "u-2", name: "Sita Karki", email: "accounts@abcmanufacturing.com.np", phone: "9841556677", role: "Accountant", active: true },
      { id: "u-3", name: "Bikash Tamang", email: "store@abcmanufacturing.com.np", phone: "9803445566", role: "Staff", active: true },
      { id: "u-4", name: "Anita Gurung", email: "sales@abcmanufacturing.com.np", phone: "9818223344", role: "Staff", active: false },
    ],
    paymentMethods: [
      { value: "cash", label: "Cash", enabled: true },
      { value: "bank", label: "Bank", enabled: true },
      { value: "esewa", label: "eSewa", enabled: true },
      { value: "khalti", label: "Khalti", enabled: true },
      { value: "credit", label: "Credit / Due", enabled: true },
      { value: "other", label: "Other", enabled: true },
    ],
  }
}
