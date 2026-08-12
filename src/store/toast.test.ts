import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useToastStore } from "@/store/toast";

beforeEach(() => {
  vi.useFakeTimers();
  useToastStore.setState({ toasts: [] });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useToastStore", () => {
  it("add 追加带 id 的 toast", () => {
    useToastStore.getState().add({ type: "success", title: "完成" });
    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toMatchObject({ type: "success", title: "完成" });
    expect(toasts[0].id).toBeTruthy();
  });

  it("duration 到期后自动移除", () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(
      "toast-1" as unknown as `${string}-${string}-${string}-${string}-${string}`,
    );
    useToastStore
      .getState()
      .add({ type: "info", title: "提示", duration: 500 });
    expect(useToastStore.getState().toasts).toHaveLength(1);

    vi.advanceTimersByTime(500);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("duration 为 0 时不移除", () => {
    useToastStore
      .getState()
      .add({ type: "warning", title: "常驻", duration: 0 });
    vi.advanceTimersByTime(10000);
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });

  it("remove 按 id 移除指定 toast", () => {
    useToastStore.getState().add({ type: "error", title: "错误", duration: 0 });
    useToastStore.getState().add({ type: "info", title: "提示", duration: 0 });
    const first = useToastStore.getState().toasts[0];

    useToastStore.getState().remove(first.id);
    const rest = useToastStore.getState().toasts;
    expect(rest).toHaveLength(1);
    expect(rest[0].title).toBe("提示");
  });
});
