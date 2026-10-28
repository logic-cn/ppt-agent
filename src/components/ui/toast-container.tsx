import { useToastStore } from "@/store/toast";
import { X, CheckCircle2, XCircle, AlertTriangle, Info } from "lucide-react";
import type { ToastType } from "@/store/toast";

const iconMap: Record<ToastType, { Icon: typeof Info; className: string }> = {
  success: { Icon: CheckCircle2, className: "text-success" },
  error: { Icon: XCircle, className: "text-danger" },
  info: { Icon: Info, className: "text-accent" },
  warning: { Icon: AlertTriangle, className: "text-warning" },
};

export function ToastContainer() {
  const { toasts, remove } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => {
        const { Icon, className } = iconMap[t.type];
        return (
          <div
            key={t.id}
            className="pointer-events-auto flex min-w-[280px] max-w-[400px] items-start gap-3 rounded-xl border border-border bg-bg-elevated px-4 py-3 shadow-lg animate-toast"
          >
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${className}`} />
            <div className="flex-1">
              <p className="text-sm font-medium text-text-primary">{t.title}</p>
              {t.message && (
                <p className="mt-0.5 text-xs text-text-secondary">
                  {t.message}
                </p>
              )}
            </div>
            <button
              onClick={() => remove(t.id)}
              aria-label="close"
              className="shrink-0 rounded p-0.5 text-text-muted opacity-60 transition-opacity hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
