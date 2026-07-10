import type { Template } from "@/types/template";

export const competitorAnalysis: Template = {
  id: "competitor-analysis",
  name: "竞品分析",
  description: "适合市场竞争格局、竞品功能对比与差异化策略",
  scenario: "market_analysis",
  suggestedTheme: "tech-purple",
  suggestedPageCount: 11,
  slides: [
    {
      layout: "cover",
      title: "{行业}竞品分析报告",
      subtitle: "分析周期 | 汇报人",
    },
    {
      layout: "content",
      title: "分析背景与目的",
      bullets: [
        { text: "为什么要做这次竞品分析", level: 0 },
        { text: "分析范围与维度", level: 0 },
        { text: "关键结论预览", level: 0 },
      ],
    },
    {
      layout: "section",
      title: "行业格局",
    },
    {
      layout: "chart",
      title: "市场份额分布",
      chart: {
        type: "pie",
        title: "主要玩家份额",
        data: [
          { label: "竞品A", value: 35 },
          { label: "竞品B", value: 28 },
          { label: "竞品C", value: 18 },
          { label: "其他", value: 19 },
        ],
      },
    },
    {
      layout: "content",
      title: "主要竞品概览",
      bullets: [
        { text: "竞品A：定位与目标用户", level: 0 },
        { text: "竞品B：核心卖点", level: 0 },
        { text: "竞品C：差异化特色", level: 0 },
      ],
    },
    {
      layout: "section",
      title: "功能对比",
    },
    {
      layout: "cols-3",
      title: "核心能力对比",
      items: [
        {
          title: "竞品A",
          bullets: ["优势一", "优势二", "短板"],
        },
        {
          title: "竞品B",
          bullets: ["优势一", "优势二", "短板"],
        },
        {
          title: "我们",
          bullets: ["优势一", "优势二", "待补强"],
        },
      ],
    },
    {
      layout: "two-column",
      title: "定价策略",
      bullets: [
        { text: "竞品定价区间", level: 0 },
        { text: "我们的定价策略", level: 0 },
      ],
      image: { type: "icon", alt: "价格对比图" },
    },
    {
      layout: "content",
      title: "差异化机会",
      bullets: [
        { text: "竞品未覆盖的用户痛点", level: 0 },
        { text: "我们可以切入的场景", level: 0 },
        { text: "技术与资源壁垒", level: 0 },
      ],
    },
    {
      layout: "section",
      title: "行动建议",
    },
    {
      layout: "closing",
      title: "总结",
      subtitle: "聚焦差异化，抢占空白市场",
    },
  ],
};
