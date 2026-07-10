import type { Template } from "@/types/template";

export const marketAnalysis: Template = {
  id: "market-analysis",
  name: "市场分析报告",
  description: "适合市场调研、行业分析、竞争格局研究",
  scenario: "market_analysis",
  suggestedTheme: "vibrant-orange",
  suggestedPageCount: 11,
  slides: [
    {
      layout: "cover",
      title: "市场分析报告",
      subtitle: "行业名称 | 分析日期",
    },
    {
      layout: "content",
      title: "报告框架",
      bullets: [
        { text: "行业概况", level: 0 },
        { text: "市场规模与趋势", level: 0 },
        { text: "竞争格局", level: 0 },
        { text: "用户画像", level: 0 },
        { text: "机会与建议", level: 0 },
      ],
    },
    {
      layout: "section",
      title: "行业概况",
    },
    {
      layout: "content",
      title: "行业定义与范畴",
      body: "此处填写行业的定义、边界、主要参与者和产业链概况。建议包含行业的核心特征和发展阶段判断。",
    },
    {
      layout: "section",
      title: "市场规模与趋势",
    },
    {
      layout: "chart",
      title: "市场规模",
      chart: {
        type: "bar",
        title: "近年市场规模（亿元）",
        data: [
          { label: "2021", value: 120 },
          { label: "2022", value: 156 },
          { label: "2023", value: 198 },
          { label: "2024E", value: 245 },
          { label: "2025E", value: 300 },
        ],
      },
    },
    {
      layout: "two-column",
      title: "增长驱动因素",
      bullets: [
        {
          text: "政策驱动",
          level: 0,
          children: [
            { text: "相关政策一", level: 1 },
            { text: "相关政策二", level: 1 },
          ],
        },
        {
          text: "技术驱动",
          level: 0,
          children: [
            { text: "技术突破一", level: 1 },
            { text: "技术突破二", level: 1 },
          ],
        },
        {
          text: "需求驱动",
          level: 0,
          children: [
            { text: "需求变化一", level: 1 },
            { text: "需求变化二", level: 1 },
          ],
        },
      ],
      image: { type: "icon", alt: "增长趋势图" },
    },
    {
      layout: "section",
      title: "竞争格局",
    },
    {
      layout: "chart",
      title: "市场份额分布",
      chart: {
        type: "pie",
        title: "主要厂商市场份额",
        data: [
          { label: "厂商A", value: 32 },
          { label: "厂商B", value: 25 },
          { label: "厂商C", value: 18 },
          { label: "厂商D", value: 12 },
          { label: "其他", value: 13 },
        ],
      },
    },
    {
      layout: "content",
      title: "机会与建议",
      bullets: [
        {
          text: "市场机会",
          level: 0,
          children: [
            { text: "机会一：XX", level: 1 },
            { text: "机会二：XX", level: 1 },
            { text: "机会三：XX", level: 1 },
          ],
        },
        {
          text: "战略建议",
          level: 0,
          children: [
            { text: "建议一：XX", level: 1 },
            { text: "建议二：XX", level: 1 },
          ],
        },
        {
          text: "风险提示",
          level: 0,
          children: [
            { text: "风险一：XX", level: 1 },
            { text: "风险二：XX", level: 1 },
          ],
        },
      ],
    },
    {
      layout: "closing",
      title: "谢谢",
      subtitle: "联系方式",
    },
  ],
};
