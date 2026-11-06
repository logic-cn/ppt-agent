import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "outline-danger"
  | "danger"
  | "danger-outline"
  | "ghost"
  | "ai";
type ButtonSize = "xs" | "sm" | "md";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-on-accent hover:bg-accent-hover shadow-sm shadow-accent/20",
  secondary:
    "border border-border-strong bg-bg-elevated text-text-primary hover:bg-bg-hover",
  // 透明底描边按钮：用于检查器内的次级操作
  outline:
    "border border-border text-text-secondary hover:border-accent hover:text-accent",
  "outline-danger":
    "border border-border text-text-secondary hover:border-danger/50 hover:text-danger",
  danger: "bg-danger text-on-danger hover:bg-danger/90",
  "danger-outline": "border border-danger/30 text-danger hover:bg-danger/10",
  ghost: "text-text-secondary hover:bg-bg-hover hover:text-text-primary",
  ai: "bg-ai text-on-ai hover:bg-ai-hover shadow-sm shadow-ai/20",
};

const sizeClasses: Record<ButtonSize, string> = {
  xs: "gap-1.5 px-3 py-1.5 text-xs",
  sm: "gap-1.5 px-3 py-1.5 text-sm",
  md: "gap-2 px-4 py-2 text-sm",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** 加载态：自动禁用并显示 spinner，保持按钮宽度稳定 */
  loading?: boolean;
}

/**
 * 统一按钮：集中管理颜色、间距、禁用与加载态，
 * 避免各页面手写 class 导致状态表现分叉。
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "secondary",
      size = "sm",
      loading = false,
      disabled,
      className = "",
      children,
      type = "button",
      ...rest
    },
    ref,
  ) {
    return (
      <button
        {...rest}
        ref={ref}
        type={type}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={`inline-flex shrink-0 items-center justify-center rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      >
        {loading && (
          <Loader2
            className="h-3.5 w-3.5 shrink-0 animate-spin"
            aria-hidden="true"
          />
        )}
        {children}
      </button>
    );
  },
);
