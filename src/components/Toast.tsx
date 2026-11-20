import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Icon } from './Icon'

interface ToastItem {
  id: number
  text: string
  action?: { label: string; run: () => void }
}

interface ToastApi {
  /** Show a short confirmation. Pass an action (for example Undo) to let the person reverse it. */
  toast: (text: string, action?: { label: string; run: () => void }) => void
}

const Ctx = createContext<ToastApi>({ toast: () => {} })
export const useToast = () => useContext(Ctx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)
  const timers = useRef(new Map<number, number>())

  const dismiss = useCallback((id: number) => {
    window.clearTimeout(timers.current.get(id))
    timers.current.delete(id)
    setItems((list) => list.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback<ToastApi['toast']>(
    (text, action) => {
      const id = nextId.current++
      // Only the latest message stays, so they never pile up over the tab bar.
      setItems([{ id, text, action }])
      timers.current.forEach((t) => window.clearTimeout(t))
      timers.current.clear()
      timers.current.set(id, window.setTimeout(() => dismiss(id), action ? 7000 : 3500))
    },
    [dismiss],
  )

  useEffect(() => {
    const live = timers.current
    return () => live.forEach((t) => window.clearTimeout(t))
  }, [])

  const api = useMemo(() => ({ toast }), [toast])

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className="toast">
            <Icon name="check" size={18} />
            <span className="toast-text">{t.text}</span>
            {t.action && (
              <button
                className="toast-action"
                onClick={() => {
                  t.action?.run()
                  dismiss(t.id)
                }}
              >
                {t.action.label}
              </button>
            )}
            <button className="toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss">
              <Icon name="close" size={16} />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}
