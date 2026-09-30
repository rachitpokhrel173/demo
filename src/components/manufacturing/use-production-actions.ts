"use client"

import { toast } from "sonner"
import { useStore } from "@/lib/store"
import { confirmAction } from "@/lib/ui-store"
import type { Production, ProductionStatus } from "@/lib/types"

/** Status transitions for a production entry, with confirmation + toast. */
export function useProductionActions() {
  const setStatus = useStore((s) => s.setProductionStatus)
  return async (p: Production, status: ProductionStatus) => {
    if (status === "cancelled") {
      const ok = await confirmAction({ title: `Cancel ${p.number}?`, description: "No stock will be changed.", confirmText: "Cancel Production", destructive: true })
      if (!ok) return
    }
    if (status === "completed") {
      const ok = await confirmAction({ title: `Complete ${p.number}?`, description: `Raw materials will be deducted from stock and ${p.qty} units of finished goods will be added.`, confirmText: "Complete Production" })
      if (!ok) return
    }
    const r = setStatus(p.id, status)
    if (!r.ok) toast.error("Cannot update production", { description: r.error })
    else toast.success(status === "completed" ? `${p.number} completed — stock updated` : status === "in_progress" ? `${p.number} started` : `${p.number} cancelled`)
  }
}
