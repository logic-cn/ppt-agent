import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import { ToastContainer } from "@/components/ui/toast-container";
import { ErrorBoundary } from "@/components/error-boundary";
import { useTheme } from "@/hooks/use-theme";
import { useT } from "@/hooks/use-page-t";

const Editor = lazy(() => import("./pages/Editor"));

export default function App() {
  useTheme();
  const t = useT();
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/editor/:id"
          element={
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center text-text-muted">
                  {t("common.loading")}
                </div>
              }
            >
              <Editor />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastContainer />
    </ErrorBoundary>
  );
}
