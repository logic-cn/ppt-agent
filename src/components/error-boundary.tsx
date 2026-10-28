import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { t } from "@/services/i18n";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * 全局错误边界：渲染期异常不应白屏整个应用。
 * 捕获后提供刷新入口；LLM 生成等异步错误仍由 jobStore/toast 承载。
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled render error:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-bg-base p-8 text-center">
        <AlertTriangle className="h-10 w-10 text-warning" />
        <div>
          <h1 className="text-lg font-semibold text-text-primary">
            {t("errorBoundary.title")}
          </h1>
          <p className="mt-1 max-w-md text-sm text-text-secondary">
            {t("errorBoundary.message")}
          </p>
          <pre className="mt-3 max-h-32 max-w-xl overflow-auto whitespace-pre-wrap rounded-lg bg-bg-surface px-3 py-2 text-left text-xs text-text-muted">
            {this.state.error.message}
          </pre>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm text-white transition hover:opacity-90"
        >
          <RotateCw className="h-4 w-4" />
          {t("errorBoundary.reload")}
        </button>
      </div>
    );
  }
}
