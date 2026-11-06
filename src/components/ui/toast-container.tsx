import { useToastStore } from "@/store/toast";
import { X, CheckCircle2, XCircle, AlertTriangle, Info } from "lucide-react";
import type { ToastType } from "@/store/toast";
import { useT } from "@/hooks/use-page-t";
import { IconButton } from "@/components/ui/icon-button";

const iconMap: Record<ToastType, { Icon: typeof Info; className: string }> = {
  success: { Icon: CheckCircle2, className: "text-success" },
  error: { Icon: XCircle, className: "text-danger" },
  info: { Icon: Info, className: "text-accent" },
  warning: { Icon: AlertTriangle, className: "text-warning" },
};

export function ToastContainer() {
  const { toasts, remove } = useToastStore();
  const t = useT();

  if (toasts.length === 0) return null;

  return (
    <div
      role="region"
      aria-label={t("common.notifications")}
      // 普通通知走容器级 polite；错误项自身 role="alert" 为 assertive
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2"
    >
      {toasts.map((toast) => {
        const { Icon, className } = iconMap[toast.type];
        return (
          <div
            key={toast.id}
            // 错误用 alert（ assertive ），其余用 status（polite ），让读屏及时感知
            role={toast.type === "error" ? "alert" : "status"}
            className="pointer-events-auto flex min-w-[280px] max-w-[400px] items-start gap-3 rounded-xl border border-border bg-bg-elevated px-4 py-3 shadow-lg animate-toast"
          >
            <Icon
              className={`mt-0.5 h-4 w-4 shrink-0 ${className}`}
              aria-hidden="true"
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-text-primary">
                {toast.title}
              </p>
              {toast.message && (
                <p className="mt-0.5 text-xs text-text-secondary">
                  {toast.message}
                </p>
              )}
            </div>
            <IconButton
              label={t("common.close")}
              onClick={() => remove(toast.id)}
              icon={<X className="h-3.5 w-3.5" />}
            />
          </div>
        );
      })}
    </div>
  );
}
