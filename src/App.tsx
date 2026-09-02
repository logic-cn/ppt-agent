import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import Settings from "./pages/Settings";
import { ToastContainer } from "@/components/ui/toast-container";
import { useTheme } from "@/hooks/use-theme";

const Editor = lazy(() => import("./pages/Editor"));

export default function App() {
  useTheme();
  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/editor/:id"
          element={
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center text-text-muted">
                  加载中…
                </div>
              }
            >
              <Editor />
            </Suspense>
          }
        />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastContainer />
    </>
  );
}
