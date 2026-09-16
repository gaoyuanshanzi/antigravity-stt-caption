import React from 'react'
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react'
import type { ToastMessage } from '../types'

interface ToastContainerProps {
  toasts: ToastMessage[]
  onDismiss: (id: string) => void
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onDismiss,
}) => {
  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const iconConfig = {
          info: <Info className="w-4 h-4 text-blue-500 shrink-0" />,
          success: <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />,
          warning: <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />,
          error: <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />,
        }

        const borderConfig = {
          info: 'border-blue-200 bg-blue-50/90 text-blue-900',
          success: 'border-emerald-200 bg-emerald-50/90 text-emerald-900',
          warning: 'border-amber-200 bg-amber-50/90 text-amber-900',
          error: 'border-red-200 bg-red-50/90 text-red-900',
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-lg backdrop-blur-md transition-all animate-in slide-in-from-top-2 duration-200 ${borderConfig[toast.type]}`}
          >
            <div className="mt-0.5">{iconConfig[toast.type]}</div>
            <p className="flex-1 text-xs font-medium leading-relaxed">
              {toast.message}
            </p>
            <button
              onClick={() => onDismiss(toast.id)}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
