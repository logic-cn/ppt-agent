import type { SemanticRole } from "@/types/page-plan";

/** 单页生成的 SVG 产物 */
export interface SvgPage {
  /** 页序号（0-based） */
  index: number;
  /** 语义角色 */
  role: SemanticRole;
  /** 设计真相 SVG 字符串 */
  svg: string;
}
