import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, cleanup } from "@testing-library/react";
import { useTheme } from "@/hooks/use-theme";
import { useSettingsStore } from "@/store/settings";
import type { AppSettings } from "@/types/llm";

function baseSettings(): AppSettings {
  return {
    version: 1,
    activeProvider: "openai",
    providers: {} as AppSettings["providers"],
    imageEnabled: false,
    lang: "zh",
    theme: "light",
  };
}

function Probe() {
  useTheme();
  return null;
}

let darkListeners: Array<(e: MediaQueryListEvent) => void> = [];

function makeMql(matches: boolean): MediaQueryList {
  return {
    matches,
    media: "(prefers-color-scheme: dark)",
    onchange: null,
    addEventListener: (_ev: string, cb: (e: MediaQueryListEvent) => void) => {
      darkListeners.push(cb);
    },
    removeEventListener: (
      _ev: string,
      cb: (e: MediaQueryListEvent) => void,
    ) => {
      darkListeners = darkListeners.filter((l) => l !== cb);
    },
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  } as unknown as MediaQueryList;
}

beforeEach(() => {
  darkListeners = [];
  document.documentElement.classList.remove("dark");
  window.matchMedia = vi.fn((query: string) =>
    makeMql(query.includes("dark")),
  ) as unknown as typeof window.matchMedia;
  useSettingsStore.setState({ settings: baseSettings(), loaded: true });
});

afterEach(() => {
  cleanup();
});

describe("useTheme", () => {
  it("theme=light 不添加 dark class", () => {
    render(<Probe />);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("theme=dark 添加 dark class", () => {
    render(<Probe />);
    act(() => {
      useSettingsStore.setState((s) => ({
        settings: { ...s.settings, theme: "dark" },
      }));
    });
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("theme=system 跟随系统暗色偏好", () => {
    render(<Probe />);
    act(() => {
      useSettingsStore.setState((s) => ({
        settings: { ...s.settings, theme: "system" },
      }));
    });
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(darkListeners.length).toBe(1);
  });
});
