"use client"

import { useMemo } from "react"
import { paidMap, partySummaries, stockMap } from "./ledger"
import { useStore } from "./store"
import type { ID, Party, Product } from "./types"

export function useStockMap() {
  const moves = useStore((s) => s.stockMovements)
  return useMemo(() => stockMap(moves), [moves])
}

export function usePartySummaries() {
  const parties = useStore((s) => s.parties)
  const invoices = useStore((s) => s.invoices)
  const purchases = useStore((s) => s.purchases)
  const payments = useStore((s) => s.payments)
  return useMemo(() => partySummaries({ parties, invoices, purchases, payments }), [parties, invoices, purchases, payments])
}

/** Paid amount keyed by invoice id or purchase id */
export function useDocPaid() {
  const payments = useStore((s) => s.payments)
  return useMemo(() => paidMap(payments), [payments])
}
export const useInvoicePaid = useDocPaid
export const usePurchasePaid = useDocPaid

export function useProductMap() {
  const products = useStore((s) => s.products)
  return useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])) as Record<ID, Product>, [products])
}

export function usePartyMap() {
  const parties = useStore((s) => s.parties)
  return useMemo(() => Object.fromEntries(parties.map((p) => [p.id, p])) as Record<ID, Party>, [parties])
}
