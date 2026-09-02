"use client"

import { CircleAlert, CircleCheck, CircleX, Info } from "lucide-react"

import { useToast } from "~/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "~/components/ui/toast"

// Figma 토스트 variant 별 좌측 아이콘. 아이콘 색은 toast 의 text 색(currentColor)을 상속한다.
const VARIANT_ICON = {
  default: Info,
  info: Info,
  success: CircleCheck,
  warning: CircleAlert,
  error: CircleX,
  destructive: CircleX,
} as const

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        const Icon = VARIANT_ICON[variant ?? "default"]
        return (
          <Toast key={id} variant={variant} {...props}>
            {Icon && (
              <Icon className="h-10 w-10 shrink-0" strokeWidth={1.75} aria-hidden />
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
