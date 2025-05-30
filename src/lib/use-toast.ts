"use client"

import * as React from "react"

type ToastType = {
  title: string
  description?: string
  variant?: "default" | "destructive"
}

export function useToast() {
  const showToast = React.useCallback(({ title, description, variant = "default" }: ToastType) => {
    const event = new CustomEvent("toast", {
      detail: { title, description, variant },
    })
    window.dispatchEvent(event)
  }, [])

  return { showToast }
}

export function toast({ title, description, variant = "default" }: ToastType) {
  const event = new CustomEvent("toast", {
    detail: { title, description, variant },
  })
  window.dispatchEvent(event)
}
