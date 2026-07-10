/**
 * 渲染器选择（feature flag）。
 *
 * 路线图 §6.5/§6.6 要求：Preview 与 PPTX 迁移到 RenderIR 期间，允许通过
 * feature flag 临时切回旧渲染器以做对比。迁移完成后，旧渲染器（SlideRenderer）
 * 已按"明确迁移路径 + golden 测试证明渲染一致性"移除，因此当前仅保留 `render-ir`
 * 一种模式。此处保留切换点，未来若要恢复旧渲染器或新增渲染器，只需在此扩展
 * RendererMode 并在 Preview / PPTX 入口补充分支，无需改动调用方。
 */
export type RendererMode = "render-ir";

const ENV_MODE =
  (import.meta.env.VITE_RENDERER_MODE as RendererMode | undefined) ??
  "render-ir";

let override: RendererMode | null = null;

export function getRendererMode(): RendererMode {
  return override ?? ENV_MODE;
}

export function setRendererMode(mode: RendererMode): void {
  override = mode;
}
