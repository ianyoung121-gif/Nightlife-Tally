// Simplified mock for useToast so we don't need all shadcn primitives
import * as React from "react"

const TOAST_LIMIT = 1
const TOAST_REMOVE_DELAY = 1000000

type ToasterToast = {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
}

let count = 0

function generateId() {
  count = (count + 1) % Number.MAX_VALUE
  return count.toString()
}

export function useToast() {
  const [toasts, setToasts] = React.useState<ToasterToast[]>([])

  const toast = React.useCallback(
    ({ ...props }: Omit<ToasterToast, "id">) => {
      const id = generateId()
      const newToast = { id, ...props }

      setToasts((toasts) => [newToast, ...toasts].slice(0, TOAST_LIMIT))
      
      // We don't render a real toast UI here just use a simple window alert or custom minimal component if we wanted.
      // But the App.tsx has <Toaster /> imported from "@/components/ui/toaster". Let's create a stub.
      return {
        id: id,
        dismiss: () => setToasts((toasts) => toasts.filter((t) => t.id !== id)),
        update: (props: ToasterToast) =>
          setToasts((toasts) =>
            toasts.map((t) => (t.id === id ? { ...t, ...props } : t))
          ),
      }
    },
    []
  )

  return {
    toasts,
    toast,
    dismiss: (toastId?: string) => setToasts((toasts) => toasts.filter((t) => t.id !== toastId)),
  }
}
