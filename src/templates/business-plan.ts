import type { Template } from "@/types/template";

export const businessPlan: Template = {
  id: "business-plan",
  name: "商业计划书",
  description: "适合创业融资、项目立项、商业模式阐述",
  scenario: "proposal",
  suggestedPageCount: 12,
  slides: [
    {
      layout: "cover",
      title: "商业计划书",
      subtitle: "项目名称 | 团队名称 | 日期",
    },
    {
      layout: "content",
      title: "执行摘要",
      bullets: [
        { text: "项目定位", level: 0 },
        { text: "核心价值主张", level: 0 },
        { text: "目标市场", level: 0 },
        { text: "商业模式概述", level: 0 },
        { text: "融资需求", level: 0 },
      ],
    },
    {
      layout: "section",
      title: "项目背景",
    },
    {
      layout: "content",
      title: "市场痛点分析",
      bullets: [
        {
          text: "核心痛点",
          level: 0,
          children: [
            { text: "痛点一描述", level: 1 },
            { text: "痛点二描述", level: 1 },
            { text: "痛点三描述", level: 1 },
          ],
        },
        {
          text: "现有方案不足",
          level: 0,
          children: [
            { text: "不足一", level: 1 },
            { text: "不足二", level: 1 },
          ],
        },
      ],
    },
    {
      layout: "section",
      title: "产品与解决方案",
    },
    {
      layout: "cols-3",
      title: "核心功能矩阵",
      items: [
        { title: "功能模块A", bullets: ["特性一", "特性二", "特性三"] },
        { title: "功能模块B", bullets: ["特性一", "特性二", "特性三"] },
        { title: "功能模块C", bullets: ["特性一", "特性二", "特性三"] },
      ],
    },
    {
      layout: "content",
      title: "竞争优势",
      bullets: [
        {
          text: "技术壁垒",
          level: 0,
          children: [{ text: "专利/技术优势", level: 1 }],
        },
        {
          text: "团队优势",
          level: 0,
          children: [{ text: "核心团队背景", level: 1 }],
        },
        {
          text: "先发优势",
          level: 0,
          children: [{ text: "市场先机", level: 1 }],
        },
      ],
    },
    {
      layout: "section",
      title: "商业模式",
    },
    {
      layout: "two-column",
      title: "收入模型",
      bullets: [
        { text: "收入来源一：XX", level: 0 },
        { text: "收入来源二：XX", level: 0 },
        { text: "收入来源三：XX", level: 0 },
      ],
      image: { type: "icon", alt: "商业模式图" },
    },
    {
      layout: "chart",
      title: "财务预测",
      chart: {
        type: "bar",
        title: "未来三年营收预测（万元）",
        data: [
          { label: "第一年", value: 500 },
          { label: "第二年", value: 1200 },
          { label: "第三年", value: 3000 },
        ],
      },
    },
    {
      layout: "section",
      title: "融资计划",
    },
    {
      layout: "content",
      title: "融资需求与用途",
      bullets: [
        { text: "融资金额：XX 万元", level: 0 },
        { text: "出让股权：XX%", level: 0 },
        {
          text: "资金用途",
          level: 0,
          children: [
            { text: "产品研发：XX%", level: 1 },
            { text: "市场推广：XX%", level: 1 },
            { text: "团队建设：XX%", level: 1 },
            { text: "运营储备：XX%", level: 1 },
          ],
        },
      ],
    },
    {
      layout: "closing",
      title: "期待合作",
      subtitle: "联系方式 | 邮箱 | 电话",
    },
  ],
};
