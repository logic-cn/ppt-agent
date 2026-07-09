import { useDeckStore } from "@/store/deck";
import type { SlideLayout, BulletNode } from "@/types/deck";

/** 解析用户自然语言指令，直接修改当前 deck */
export function applyUserIntent(text: string): {
  action: "modify" | "unknown";
  reply: string;
} {
  const deck = useDeckStore.getState().deck;
  if (!deck) return { action: "unknown", reply: "请先生成大纲后再操作。" };

  const slides = deck.slides;
  const { updateSlide, addSlide, removeSlide, moveSlide } =
    useDeckStore.getState();

  const t = text.trim();

  // === 删除页面 ===
  const deleteMatch = t.match(/删(?:掉|除)?\s*(?:第\s*)?(\d+)\s*页/);
  if (deleteMatch) {
    const idx = parseInt(deleteMatch[1]) - 1;
    if (idx >= 0 && idx < slides.length) {
      const title = slides[idx].title || `第 ${idx + 1} 页`;
      removeSlide(slides[idx].id);
      return { action: "modify", reply: `已删除「${title}」。` };
    }
    return { action: "modify", reply: `没有找到第 ${idx + 1} 页。` };
  }

  // === 修改布局 ===
  const layoutMap: Record<string, SlideLayout> = {
    封面: "cover",
    章节: "section",
    正文: "content",
    双栏: "two-column",
    图表: "chart",
    配图: "image",
    结尾: "closing",
  };
  const layoutMatch = t.match(
    /(?:把|将)?\s*(?:第\s*)?(\d+)\s*页\s*(?:改成|改为|变成)\s*(\S+)/,
  );
  if (layoutMatch) {
    const idx = parseInt(layoutMatch[1]) - 1;
    const targetLayout = layoutMatch[2];
    const layout = layoutMap[targetLayout];
    if (idx >= 0 && idx < slides.length && layout) {
      updateSlide(slides[idx].id, { layout });
      return {
        action: "modify",
        reply: `已将第 ${idx + 1} 页「${slides[idx].title}」改为「${targetLayout}」布局。`,
      };
    }
  }

  // === 新增页面 ===
  // 检查不是其他指令（给/把/将等），避免误匹配
  if (!/^[给把将]/.test(t)) {
    const addMatch = t.match(/(?:加|新增|增加)(?:一页|一个|个)?\s*(.+?)$/);
    if (addMatch) {
      const title = addMatch[1];
      // 检测是否包含图表
      const isChart = /图表|柱状图|饼图|折线图/.test(t);
      const newSlide = {
        id: crypto.randomUUID(),
        layout: (isChart ? "chart" : "content") as SlideLayout,
        title,
      };
      addSlide(newSlide);
      return {
        action: "modify",
        reply: `已新增一页「${title}」。${isChart ? "建议在右侧属性面板调整图表数据。" : ""}`,
      };
    }
  }

  // === 移动页面 ===
  const moveMatch = t.match(
    /(?:把|将)?\s*(?:第\s*)?(\d+)\s*页\s*(?:移到|移动到|移至)\s*(?:第\s*)?(\d+)\s*页\s*(?:前|后)/,
  );
  if (moveMatch) {
    const from = parseInt(moveMatch[1]) - 1;
    const to = parseInt(moveMatch[2]) - 1;
    if (from >= 0 && to >= 0 && from < slides.length && to < slides.length) {
      moveSlide(from, to);
      return {
        action: "modify",
        reply: `已将第 ${from + 1} 页移到第 ${to + 1} 页。`,
      };
    }
  }

  // === 添加 bullet 到指定页 ===
  const bulletMatch = t.match(
    /(?:给|为|在)?\s*(?:第\s*)?(\d+)\s*页\s*(?:添加|增加|加个?)\s*(?:要点|bullet|条目)[：:]\s*(.+)/,
  );
  if (bulletMatch) {
    const idx = parseInt(bulletMatch[1]) - 1;
    const content = bulletMatch[2];
    if (idx >= 0 && idx < slides.length) {
      const slide = slides[idx];
      const existingBullets = slide.bullets ?? [];
      const newBullet: BulletNode = {
        id: crypto.randomUUID(),
        text: content,
        level: 0,
      };
      updateSlide(slide.id, { bullets: [...existingBullets, newBullet] });
      return {
        action: "modify",
        reply: `已为「${slide.title}」添加了一个要点。`,
      };
    }
  }

  return { action: "unknown", reply: "" };
}
