import type { Template } from "@/types/template";

export const annualPlan: Template = {
  id: "annual-plan",
  name: "年度规划",
  description: "适合年度战略拆解、OKR 对齐与目标承诺",
  scenario: "business_review",
  suggestedTheme: "business-blue",
  suggestedPageCount: 10,
  slides: [
    {
      layout: "cover",
      title: "{年份} 年度规划",
      subtitle: "团队/部门 | 负责人",
    },
    {
      layout: "content",
      title: "上一年回顾",
      bullets: [
        { text: "达成的关键目标", level: 0 },
        { text: "未达预期的部分", level: 0 },
        { text: "沉淀的经验", level: 0 },
      ],
    },
    {
      layout: "section",
      title: "战略目标",
    },
    {
      layout: "cols-3",
      title: "三大战略主题",
      items: [
        {
          title: "主题一",
          bullets: ["战略意图", "关键结果"],
        },
        {
          title: "主题二",
          bullets: ["战略意图", "关键结果"],
        },
        {
          title: "主题三",
          bullets: ["战略意图", "关键结果"],
        },
      ],
    },
    {
      layout: "chart",
      title: "目标拆解",
      chart: {
        type: "bar",
        title: "季度目标分布",
        data: [
          { label: "Q1", value: 25 },
          { label: "Q2", value: 30 },
          { label: "Q3", value: 20 },
          { label: "Q4", value: 25 },
        ],
      },
    },
    {
      layout: "section",
      title: "关键举措",
    },
    {
      layout: "two-column",
      title: "组织与人才",
      bullets: [
        { text: "团队结构调整", level: 0 },
        { text: "关键岗位补强", level: 0 },
      ],
      image: { type: "icon", alt: "组织图" },
    },
    {
      layout: "content",
      title: "资源与预算",
      bullets: [
        { text: "人力预算", level: 0 },
        { text: "市场/研发预算", level: 0 },
        { text: "外部合作", level: 0 },
      ],
    },
    {
      layout: "content",
      title: "风险与保障",
      bullets: [
        { text: "外部风险", level: 0 },
        { text: "内部风险", level: 0 },
        { text: "保障举措", level: 0 },
      ],
    },
    {
      layout: "closing",
      title: "承诺与展望",
      subtitle: "{年份}，全力以赴",
    },
  ],
};
