import type { Template } from "@/types/template";

export const productLaunch: Template = {
  id: "product-launch",
  name: "产品发布会",
  description: "适合新品发布、版本更新、产品介绍",
  scenario: "pitch",
  suggestedTheme: "tech-purple",
  suggestedPageCount: 9,
  slides: [
    {
      layout: "cover",
      title: "产品名称",
      subtitle: "新品发布会 | 日期",
    },
    {
      layout: "section",
      title: "市场背景",
    },
    {
      layout: "content",
      title: "行业趋势",
      bullets: [
        { text: "市场规模：XX 亿元", level: 0 },
        { text: "年增长率：XX%", level: 0 },
        {
          text: "用户痛点分析",
          level: 0,
          children: [
            { text: "痛点一", level: 1 },
            { text: "痛点二", level: 1 },
            { text: "痛点三", level: 1 },
          ],
        },
      ],
    },
    {
      layout: "chart",
      title: "市场对比",
      chart: {
        type: "bar",
        title: "竞品市场份额",
        data: [
          { label: "竞品A", value: 35 },
          { label: "竞品B", value: 28 },
          { label: "竞品C", value: 20 },
          { label: "其他", value: 17 },
        ],
      },
    },
    {
      layout: "section",
      title: "产品介绍",
    },
    {
      layout: "image",
      title: "产品概览",
      image: { type: "icon", alt: "产品效果图" },
    },
    {
      layout: "cols-3",
      title: "核心功能",
      items: [
        {
          title: "功能一",
          bullets: ["特点描述一", "特点描述二", "特点描述三"],
        },
        {
          title: "功能二",
          bullets: ["特点描述一", "特点描述二", "特点描述三"],
        },
        {
          title: "功能三",
          bullets: ["特点描述一", "特点描述二", "特点描述三"],
        },
      ],
    },
    {
      layout: "content",
      title: "产品优势",
      bullets: [
        { text: "技术领先：XX 专利", level: 0 },
        { text: "用户体验：NPS XX", level: 0 },
        { text: "性价比：降低 XX% 成本", level: 0 },
      ],
    },
    {
      layout: "closing",
      title: "期待合作",
      subtitle: "联系方式 | 官网地址",
    },
  ],
};
