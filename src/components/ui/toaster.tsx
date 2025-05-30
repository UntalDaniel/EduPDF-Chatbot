"use client"

import * as React from "react"
import { Check, X } from "lucide-react"
import { Toast, ToastProvider, ToastViewport } from "@/components/ui/toast"

export function Toaster() {
  const [toasts, setToasts] = React.useState<Array<{
    id: string
    title: string
    description?: string
    variant?: "default" | "destructive"
  }>>([])

  React.useEffect(() => {
    const handleToast = (event: CustomEvent) => {
      const { title, description, variant = "default" } = event.detail
      setToasts((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(2, 9),
          title,
          description,
          variant,
        },
      ])
    }

    window.addEventListener("toast" as any, handleToast)
    return () => window.removeEventListener("toast" as any, handleToast)
  }, [])

  return (
    <ToastProvider>
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          variant={toast.variant}
          onOpenChange={(open) => {
            if (!open) {
              setToasts((prev) => prev.filter((t) => t.id !== toast.id))
            }
          }}
          className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full"
        >
          <div className="flex items-start">
            <div className="flex-shrink-0 pt-0.5">
              {toast.variant === "destructive" ? (
                <X className="h-5 w-5 text-destructive-foreground" />
              ) : (
                <Check className="h-5 w-5 text-green-500" />
              )}
            </div>
            <div className="ml-3 w-0 flex-1 pt-0.5">
              <p className="text-sm font-medium text-foreground">
                {toast.title}
              </p>
              {toast.description && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {toast.description}
                </p>
              )}
            </div>
          </div>
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  )
}
