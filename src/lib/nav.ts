import {
  ArrowDownLeft, ArrowUpRight, BarChart3, Boxes, ClipboardList, Factory, FileText, LayoutDashboard, Package,
  PackagePlus, Receipt, Settings, ShoppingCart, SlidersHorizontal, Truck, UserPlus, Users, Wallet,
  type LucideIcon,
} from "lucide-react"
import type { DialogState } from "./ui-store"

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  /** Nepali hint shown under the label for non-technical users */
  np?: string
}

export const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/sales", label: "Sales", icon: ShoppingCart, np: "बिक्री" },
  { href: "/purchases", label: "Purchase", icon: Truck, np: "खरिद" },
  { href: "/invoices", label: "Billing / Invoices", icon: FileText, np: "बिल" },
  { href: "/parties", label: "Parties", icon: Users, np: "पार्टी" },
  { href: "/products", label: "Products", icon: Package, np: "सामान" },
  { href: "/inventory", label: "Inventory / Stock", icon: Boxes, np: "स्टक" },
  { href: "/manufacturing", label: "Manufacturing", icon: Factory, np: "उत्पादन" },
  { href: "/payments", label: "Payments", icon: Wallet, np: "भुक्तानी" },
  { href: "/expenses", label: "Expenses", icon: Receipt, np: "खर्च" },
  { href: "/reports", label: "Reports", icon: BarChart3, np: "रिपोर्ट" },
  { href: "/settings", label: "Settings", icon: Settings },
]

export type QuickAction = { label: string; icon: LucideIcon; href?: string; dialog?: NonNullable<DialogState>; tone: string }

export const QUICK_ACTIONS: QuickAction[] = [
  { label: "New Sale", icon: ShoppingCart, href: "/sales", tone: "text-blue-600 bg-blue-50" },
  { label: "New Purchase", icon: Truck, href: "/purchases/new", tone: "text-violet-600 bg-violet-50" },
  { label: "Add Party", icon: UserPlus, dialog: { kind: "party" }, tone: "text-sky-600 bg-sky-50" },
  { label: "Add Product", icon: PackagePlus, dialog: { kind: "product" }, tone: "text-teal-600 bg-teal-50" },
  { label: "Stock Adjustment", icon: SlidersHorizontal, dialog: { kind: "stock", mode: "adjust" }, tone: "text-amber-600 bg-amber-50" },
  { label: "New Production", icon: ClipboardList, href: "/manufacturing/new", tone: "text-orange-600 bg-orange-50" },
  { label: "Receive Payment", icon: ArrowDownLeft, dialog: { kind: "payment", direction: "in" }, tone: "text-emerald-600 bg-emerald-50" },
  { label: "Give Payment", icon: ArrowUpRight, dialog: { kind: "payment", direction: "out" }, tone: "text-rose-600 bg-rose-50" },
]
