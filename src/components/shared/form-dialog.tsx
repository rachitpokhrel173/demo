"use client"

import { AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { useUI } from "@/lib/ui-store"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  onSubmit,
  submitText = "Save",
  size = "md",
  submitDisabled,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  title: string
  description?: string
  children: React.ReactNode
  onSubmit: () => void
  submitText?: string
  size?: "sm" | "md" | "lg" | "xl"
  submitDisabled?: boolean
}) {
  const w = { sm: "sm:max-w-md", md: "sm:max-w-lg", lg: "sm:max-w-2xl", xl: "sm:max-w-4xl" }[size]
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-h-[92vh] grid-rows-[auto_1fr_auto] gap-0 p-0", w)}>
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form
          id="form-dialog"
          className="overflow-y-auto px-5 py-4"
          onSubmit={(e) => {
            e.preventDefault()
            onSubmit()
          }}
        >
          {children}
        </form>
        <DialogFooter className="mx-0 mb-0 px-5 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="form-dialog" disabled={submitDisabled}>
            {submitText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Mounted once in the shell. Use `confirmAction({...})` anywhere to ask. */
export function ConfirmHost() {
  const confirm = useUI((s) => s.confirm)
  const resolve = useUI((s) => s.resolveConfirm)
  return (
    <AlertDialog open={!!confirm} onOpenChange={(o) => !o && resolve(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          {confirm?.destructive && (
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <AlertTriangle />
            </AlertDialogMedia>
          )}
          <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
          {confirm?.description && <AlertDialogDescription>{confirm.description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={confirm?.destructive ? "destructive" : "default"}
            className={confirm?.destructive ? "bg-destructive text-white hover:bg-destructive/90" : undefined}
            onClick={() => resolve(true)}
          >
            {confirm?.confirmText ?? "Confirm"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
