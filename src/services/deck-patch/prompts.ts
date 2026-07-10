import type { DeckContextSummary } from "./ai";

export function buildDeckPatchSystemPrompt(): string {
  return `你是 PPT 编辑助手。你的工作是根据用户的需求，输出结构化的 Deck JSON 修改操作。

你可以进行的操作包括：
- set_deck_title: 修改 deck 标题
- insert_slide: 插入新页面
- delete_slide: 删除页面
- move_slide: 移动页面位置
- update_slide: 修改页面的部分字段
- replace_slide: 整体替换某一页
- split_slide: 将一页拆分为多页
- merge_slides: 合并多页为一页

约束：
1. 输出必须是 JSON 对象，包含 patches 数组。
2. 不要输出解释性文本和 JSON 混排。
3. 所有 text 字段使用中文。
4. SlideDraft 中的 bullets、items 不需要 id 字段。
5. layout 字段必须是以下之一：cover, section, content, two-column, chart, image, closing, cols-2, cols-3, cols-4, cols-5, cols-6。`;
}

export function buildDeckPatchUserPrompt(params: {
  userRequest: string;
  context: DeckContextSummary;
  selectedSlideId?: string;
  conversationContext?: string;
}): string {
  const { userRequest, context, selectedSlideId, conversationContext } = params;

  const selectedInfo = selectedSlideId
    ? `\n用户当前选中的页面 ID: ${selectedSlideId}`
    : "";

  const conversationInfo = conversationContext
    ? `\n对话上下文：\n${conversationContext}`
    : "";

  return `当前 Deck 信息：
- 标题：${context.title}
- 主题：${context.themeId}
- 总页数：${context.slides.length}

页面列表：
${context.slides.map((s) => `  ${s.index + 1}. [${s.layout}] ${s.title}${s.hasChart ? " 📊" : ""}${s.hasImage ? " 🖼️" : ""}`).join("\n")}${selectedInfo}${conversationInfo}

用户需求：${userRequest}

请输出对应的 patches 数组。`;
}
