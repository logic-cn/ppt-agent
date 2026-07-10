import type { Template } from "@/types/template";

export const quarterlyReview: Template = {
  id: "quarterly-review",
  name: "季度业务汇报",
  description: "适合季度复盘、业绩回顾与下季度规划",
  scenario: "business_review",
  suggestedTheme: "business-blue",
  suggestedPageCount: 10,
  slides: [
    {
      layout: "cover",
      title: "Q{季度} 业务复盘汇报",
      subtitle: "部门名称 | 汇报日期",
    },
    {
      layout: "content",
      title: "目录",
      bullets: [
        { text: "业绩概览", level: 0 },
        { text: "核心指标达成", level: 0 },
        { text: "重点项目进展", level: 0 },
        { text: "问题与挑战", level: 0 },
        { text: "下季度规划", level: 0 },
      ],
    },
    {
      layout: "section",
      title: "业绩概览",
    },
    {
      layout: "cols-3",
      title: "核心指标",
      items: [
        {
          title: "营收",
          bullets: ["目标达成率：XX%", "同比增长：XX%", "环比增长：XX%"],
        },
        {
          title: "用户数",
          bullets: ["新增用户：XX", "活跃用户：XX", "留存率：XX%"],
        },
        {
          title: "利润",
          bullets: ["毛利润：XX", "净利润：XX", "利润率：XX%"],
        },
      ],
    },
    {
      layout: "chart",
      title: "季度趋势",
      chart: {
        type: "line",
        title: "月度数据趋势",
        data: [
          { label: "1月", value: 85 },
          { label: "2月", value: 72 },
          { label: "3月", value: 94 },
        ],
      },
    },
    {
      layout: "section",
      title: "重点项目进展",
    },
    {
      layout: "two-column",
      title: "项目 A",
      bullets: [
        { text: "目标：XX", level: 0 },
        { text: "进度：XX%", level: 0 },
        {
          text: "关键成果",
          level: 0,
          children: [
            { text: "成果一", level: 1 },
            { text: "成果二", level: 1 },
          ],
        },
      ],
      image: { type: "icon", alt: "项目图表" },
    },
    {
      layout: "content",
      title: "问题与挑战",
      bullets: [
        {
          text: "核心问题",
          level: 0,
          children: [
            { text: "问题描述一", level: 1 },
            { text: "问题描述二", level: 1 },
          ],
        },
        {
          text: "应对措施",
          level: 0,
          children: [
            { text: "措施一：XX", level: 1 },
            { text: "措施二：XX", level: 1 },
          ],
        },
        {
          text: "需要的支持",
          level: 0,
          children: [
            { text: "资源需求", level: 1 },
            { text: "协同需求", level: 1 },
          ],
        },
      ],
    },
    {
      layout: "closing",
      title: "感谢聆听",
      subtitle: "Q{季度}，再创佳绩",
    },
  ],
};
