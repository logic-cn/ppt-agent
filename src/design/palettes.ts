import type { ThemeColors } from "../types/theme";

export interface Palette {
  id: string;
  name: string;
  colors: ThemeColors;
}

export const PALETTES: Palette[] = [
  {
    id: "business-blue",
    name: "商务深蓝",
    colors: {
      primary: "#60A5FA",
      secondary: "#3B82F6",
      accent: "#FBBF24",
      background: "#0C1929",
      surface: "#1A2D42",
      text: "#F1F5F9",
      textMuted: "#94A3B8",
    },
  },
  {
    id: "minimal-white",
    name: "极简白",
    colors: {
      primary: "#111827",
      secondary: "#374151",
      accent: "#2563EB",
      background: "#FFFFFF",
      surface: "#F9FAFB",
      text: "#111827",
      textMuted: "#9CA3AF",
    },
  },
  {
    id: "tech-purple",
    name: "科技紫",
    colors: {
      primary: "#C084FC",
      secondary: "#8B5CF6",
      accent: "#22D3EE",
      background: "#0D0618",
      surface: "#1A0F2E",
      text: "#F3E8FF",
      textMuted: "#A78BFA",
    },
  },
  {
    id: "vibrant-orange",
    name: "活力橙",
    colors: {
      primary: "#9A3412",
      secondary: "#EA580C",
      accent: "#FACC15",
      background: "#FFFBEB",
      surface: "#FEF3C7",
      text: "#451A03",
      textMuted: "#B45309",
    },
  },
];

export function getPalette(id: string): Palette | undefined {
  return PALETTES.find((p) => p.id === id);
}
