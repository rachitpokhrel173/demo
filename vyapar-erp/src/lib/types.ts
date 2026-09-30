// Domain types. These mirror the tables a real database (PostgreSQL / Supabase)
// would hold, so the demo store can later be swapped for API calls.

export type ID = string

export type PartyType = "customer" | "supplier" | "both"
export type PaymentMethod = "cash" | "bank" | "esewa" | "khalti" | "credit" | "other"
export type Unit = "PCS" | "KG" | "LTR" | "BOX" | "METER" | "SET" | "BAG" | "TON"
export type ProductKind = "raw" | "finished" | "trading"

export interface BusinessProfile {
  name: string
  address: string
  phone: string
  email: string
  pan: string
  logoText: string
  invoicePrefix: string
  purchasePrefix: string
  nextInvoiceNo: number
  nextPurchaseNo: number
  nextPaymentNo: number
  nextProductionNo: number
  defaultVat: number
  vatRegistered: boolean
  invoiceFooter: string
  bankDetails: string
}

export interface Party {
  id: ID
  name: string
  type: PartyType
  phone: string
  email?: string
  address: string
  pan?: string
  /** Positive = they owe us (receivable). Negative = we owe them (payable). */
  openingBalance: number
  creditLimit: number
  status: "active" | "inactive"
  createdAt: string
}

export interface Product {
  id: ID
  name: string
  sku: string
  barcode: string
  category: string
  unit: Unit
  kind: ProductKind
  purchasePrice: number
  sellingPrice: number
  openingStock: number
  minStock: number
  vatRate: number
  status: "active" | "inactive"
  createdAt: string
}

export type StockMoveType =
  | "opening"
  | "purchase"
  | "sale"
  | "sale_return"
  | "production_in"
  | "production_out"
  | "adjustment_in"
  | "adjustment_out"
  | "manual_in"
  | "manual_out"

export interface StockMovement {
  id: ID
  date: string
  productId: ID
  type: StockMoveType
  /** Signed quantity: positive = in, negative = out */
  qty: number
  /** Unit cost at the time of movement (for valuation) */
  rate: number
  reference: string
  refId?: ID
  note?: string
}

export interface LineItem {
  productId: ID
  name: string
  unit: Unit
  qty: number
  rate: number
  /** Line discount amount (NPR) */
  discount: number
  vatRate: number
}

export interface Totals {
  subtotal: number
  discount: number
  taxable: number
  tax: number
  total: number
}

export interface Invoice extends Totals {
  id: ID
  number: string
  date: string
  partyId: ID | null
  customerName: string
  items: LineItem[]
  billDiscount: number
  notes?: string
  cancelled: boolean
  createdAt: string
}

export interface Purchase extends Totals {
  id: ID
  number: string
  supplierBillNo: string
  date: string
  partyId: ID
  items: LineItem[]
  billDiscount: number
  notes?: string
  cancelled: boolean
  createdAt: string
}

export interface Payment {
  id: ID
  number: string
  date: string
  partyId: ID | null
  direction: "in" | "out"
  amount: number
  method: PaymentMethod
  reference?: string
  notes?: string
  invoiceId?: ID
  purchaseId?: ID
  /** General payments are auto-allocated to the oldest unpaid bills (FIFO) */
  allocations?: { docId: ID; amount: number }[]
}

export type ExpenseCategory =
  | "Rent"
  | "Salary"
  | "Electricity"
  | "Transport"
  | "Office"
  | "Marketing"
  | "Maintenance"
  | "Other"

export interface Expense {
  id: ID
  date: string
  category: ExpenseCategory
  amount: number
  method: PaymentMethod
  description: string
  paidTo?: string
}

export interface BomItem {
  productId: ID
  qty: number
}

export interface Bom {
  id: ID
  productId: ID
  name: string
  /** Quantity of finished goods produced by one batch of `items` */
  outputQty: number
  items: BomItem[]
  /** Labour + overhead cost per batch (NPR) */
  overheadCost: number
  notes?: string
}

export type ProductionStatus = "draft" | "in_progress" | "completed" | "cancelled"

export interface ProductionMaterial {
  productId: ID
  required: number
  actual: number
  rate: number
}

export interface Production {
  id: ID
  number: string
  date: string
  productId: ID
  bomId: ID
  qty: number
  materials: ProductionMaterial[]
  overheadCost: number
  materialCost: number
  totalCost: number
  status: ProductionStatus
  notes?: string
}

export type UserRole = "Admin" | "Staff" | "Accountant"

export interface AppUser {
  id: ID
  name: string
  email: string
  phone: string
  role: UserRole
  active: boolean
}

export interface Notification {
  id: ID
  title: string
  body: string
  date: string
  href?: string
  read: boolean
}
