import type { ButtonHTMLAttributes, ReactNode } from "react";

type IconButtonVariant = "ghost" | "danger" | "accent";
type IconButtonSize = "sm" | "md";

interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-label" | "title"
> {
  /** 必填：同时写入 aria-label 与 title，保证读屏与悬浮提示一致 */
  label: string;
  icon: ReactNode;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
}

const variantClasses: Record<IconButtonVariant, string> = {
  ghost: "text-text-secondary hover:bg-bg-hover hover:text-text-primary",
  danger: "text-text-secondary hover:bg-danger/10 hover:text-danger",
  accent: "text-accent hover:bg-accent/10",
};

const sizeClasses: Record<IconButtonSize, string> = {
  sm: "p-1.5",
  md: "p-2",
};

/**
 * 纯图标按钮。label 为必填项，避免出现读屏只能念「按钮」的匿名控件。
 */
export function IconButton({
  label,
  icon,
  variant = "ghost",
  size = "sm",
  className = "",
  type = "button",
  ...rest
}: IconButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      aria-label={label}
      title={label}
      className={`inline-flex shrink-0 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {icon}
    </button>
  );
}
