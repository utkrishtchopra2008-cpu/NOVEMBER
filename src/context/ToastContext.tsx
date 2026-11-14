import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, Info, X, AlertTriangle } from "lucide-react";

type ToastKind = "success" | "info" | "error";
interface ToastItem { id: number; message: string; kind: ToastKind }
interface ToastContextValue { notify: (message: string, kind?: ToastKind) => void }
const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const notify = useCallback((message: string, kind: ToastKind = "success") => {
    const id = Date.now() + Math.random();
    setItems((current) => [...current, { id, message, kind }]);
    window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 3600);
  }, []);
  const value = useMemo(() => ({ notify }), [notify]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {items.map((item) => {
          const Icon = item.kind === "success" ? CheckCircle2 : item.kind === "error" ? AlertTriangle : Info;
          return <div className={`toast toast-${item.kind}`} key={item.id}>
            <Icon size={17} /><span>{item.message}</span>
            <button className="icon-button toast-close" onClick={() => setItems((current) => current.filter((x) => x.id !== item.id))} aria-label="Dismiss notification"><X size={15} /></button>
          </div>;
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}