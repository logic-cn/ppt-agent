import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { useSettingsStore } from "@/store/settings";
import { useModelStore } from "@/store/model";
import "./styles.css";

// 初始化时加载设置；设置就绪后若本地模型已下载未加载，自动加载进内存
void useSettingsStore
  .getState()
  .load()
  .then(() => useModelStore.getState().bootstrap())
  .catch(() => {});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
