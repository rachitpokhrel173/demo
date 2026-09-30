"use client"

// UI-only state: which global dialog is open, and the confirm() helper.
import { create } from "zustand"
import type { Bom, Expense, ID, Party, PartyType, Product } from "./types"

export type DialogState =
  | { kind: "party"; party?: Party; defaultType?: PartyType }
  | { kind: "product"; product?: Product }
  | { kind: "payment"; direction: "in" | "out"; partyId?: ID; invoiceId?: ID; purchaseId?: ID; amount?: number }
  | { kind: "stock"; mode: "in" | "out" | "adjust"; productId?: ID }
  | { kind: "expense"; expense?: Expense }
  | { kind: "bom"; bom?: Bom }
  | null

interface ConfirmOptions {
  title: string
  description?: string
  confirmText?: string
  destructive?: boolean
}

interface UIState {
  dialog: DialogState
  openDialog: (d: NonNullable<DialogState>) => void
  closeDialog: () => void
  confirm: (ConfirmOptions & { resolve: (v: boolean) => void }) | null
  askConfirm: (o: ConfirmOptions) => Promise<boolean>
  resolveConfirm: (v: boolean) => void
  mobileNav: boolean
  setMobileNav: (v: boolean) => void
  searchOpen: boolean
  setSearchOpen: (v: boolean) => void
  readNotifications: string[]
  markRead: (ids: string[]) => void
}

export const useUI = create<UIState>()((set, get) => ({
  dialog: null,
  openDialog: (dialog) => set({ dialog }),
  closeDialog: () => set({ dialog: null }),
  confirm: null,
  askConfirm: (o) => new Promise<boolean>((resolve) => set({ confirm: { ...o, resolve } })),
  resolveConfirm: (v) => {
    get().confirm?.resolve(v)
    set({ confirm: null })
  },
  mobileNav: false,
  setMobileNav: (mobileNav) => set({ mobileNav }),
  searchOpen: false,
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  readNotifications: [],
  markRead: (ids) => set((s) => ({ readNotifications: [...new Set([...s.readNotifications, ...ids])] })),
}))

export const confirmAction = (o: ConfirmOptions) => useUI.getState().askConfirm(o)
