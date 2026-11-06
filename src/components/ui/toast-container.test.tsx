import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useToastStore } from "@/store/toast";
import { useSettingsStore } from "@/store/settings";
import { ToastContainer } from "./toast-container";

describe("ToastContainer 无障碍语义", () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
    useSettingsStore.getState().setLang("zh");
  });

  it("容器为带名称的 region 且默认 polite，普通提示使用 status", () => {
    useToastStore.getState().add({ type: "success", title: "已保存" });
    render(<ToastContainer />);

    const region = screen.getByRole("region", { name: "通知" });
    expect(region.getAttribute("aria-live")).toBe("polite");
    expect(screen.getByRole("status").textContent).toContain("已保存");
  });

  it("错误提示使用 alert 以触发 assertive 播报", () => {
    useToastStore.getState().add({ type: "error", title: "导出失败" });
    render(<ToastContainer />);

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("导出失败");
  });

  it("关闭按钮使用 i18n 文案并可移除提示", () => {
    useToastStore.getState().add({ type: "info", title: "提示" });
    render(<ToastContainer />);

    const close = screen.getByRole("button", { name: "关闭" });
    expect(close.getAttribute("title")).toBe("关闭");
    fireEvent.click(close);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });
});
