import type { ThemeColors } from "../types/theme";

export type { ThemeColors } from "../types/theme";

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
      // primary 深到可与 text 组成 ≥4.5 对比度：端侧模型爱用「文字压 primary
      // 色横幅」，浅 primary（如 #60A5FA，2.32）会触发 deck 级 brand 硬锁，
      // 逐页重画修不动；深 primary 让该常见构图天然合规（#2563EB → 4.72）
      primary: "#2563EB",
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
      textMuted: "#6B7280",
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
  {
    id: "magazine-crimson",
    name: "杂志朱红",
    colors: {
      primary: "#B91C1C",
      secondary: "#7F1D1D",
      accent: "#F59E0B",
      background: "#FFFCF7",
      surface: "#F5EFE6",
      text: "#1C1917",
      textMuted: "#57534E",
    },
  },
  {
    id: "ink-xuan",
    name: "水墨宣纸",
    colors: {
      primary: "#1F2937",
      secondary: "#4B5563",
      accent: "#B91C1C",
      background: "#F5F1E8",
      surface: "#EAE3D4",
      text: "#1B1A17",
      textMuted: "#5B5750",
    },
  },
  {
    id: "pastel-dream",
    name: "粉彩梦境",
    colors: {
      primary: "#7C6CE0",
      secondary: "#A78BFA",
      accent: "#F0ABFC",
      background: "#FEFBFF",
      surface: "#F3EEFF",
      text: "#3B2F63",
      textMuted: "#6E63A0",
    },
  },
  {
    id: "consulting-navy",
    name: "咨询藏蓝",
    colors: {
      primary: "#1E3A5F",
      secondary: "#2C5282",
      accent: "#C05621",
      background: "#FFFFFF",
      surface: "#EDF2F7",
      text: "#1A202C",
      textMuted: "#4A5568",
    },
  },
  {
    id: "nature-sage",
    name: "自然松灰",
    colors: {
      primary: "#3F5B4A",
      secondary: "#5A7D66",
      accent: "#B45309",
      background: "#F4F6F1",
      surface: "#E6EBE0",
      text: "#26332B",
      textMuted: "#5C6B60",
    },
  },
  {
    id: "mono-noir",
    name: "单色黑白",
    colors: {
      primary: "#111111",
      secondary: "#525252",
      accent: "#A3A3A3",
      background: "#FAFAFA",
      surface: "#F0F0F0",
      text: "#0A0A0A",
      textMuted: "#525252",
    },
  },
  {
    id: "teal-deep",
    name: "深海青",
    colors: {
      primary: "#5EEAD4",
      secondary: "#2DD4BF",
      accent: "#FBBF24",
      background: "#042F2E",
      surface: "#0B3B39",
      text: "#ECFEFF",
      textMuted: "#94D4CF",
    },
  },
  {
    id: "sunset-warm",
    name: "落日暖金",
    colors: {
      primary: "#FDE68A",
      secondary: "#FCD34D",
      accent: "#FB7185",
      background: "#1C1917",
      surface: "#292524",
      text: "#FFFBEB",
      textMuted: "#D6C7A1",
    },
  },
];

let _customPalettes: Palette[] = [];

export function setCustomPalettes(p: Palette[]): void {
  _customPalettes = p;
}

export function getCustomPalettes(): Palette[] {
  return _customPalettes;
}

export function getPalettes(): Palette[] {
  return [...PALETTES, ...getCustomPalettes()];
}

export function getPalette(id: string): Palette | undefined {
  return (
    PALETTES.find((p) => p.id === id) ??
    _customPalettes.find((p) => p.id === id)
  );
}
