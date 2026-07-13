import type { GalleryExample } from "../types/example";

export const EXAMPLES: GalleryExample[] = [
  {
    id: "quarterly-pyramid-swiss",
    name: "季度复盘·结论先行·瑞士极简",
    design: {
      mode: "pyramid",
      visualStyle: "swiss-minimal",
      palette: "business-blue",
    },
    slides: [
      { id: "s1", layout: "cover", title: "Q2 业务复盘", bullets: [] },
      { id: "s2", layout: "section", title: "业绩概览", bullets: [] },
      {
        id: "s3",
        layout: "chart",
        title: "核心指标同比增长 23%，远超行业 12%",
        chart: {
          type: "line",
          title: "月度营收趋势",
          data: [
            { label: "4月", value: 85 },
            { label: "5月", value: 92 },
            { label: "6月", value: 110 },
          ],
        },
      },
      {
        id: "s4",
        layout: "content",
        title: "留存而非拉新驱动本季增长",
        bullets: [
          { id: "b1", text: "复购贡献 60% 的营收增长", level: 0 },
          { id: "b2", text: "CAC 同比 +40%，获客效率下降", level: 0 },
          { id: "b3", text: "老客年框签约占比提升至 35%", level: 1 },
        ],
      },
      {
        id: "s5",
        layout: "two-column",
        title: "增长结构正在从规模转向质量",
        bullets: [
          { id: "b1", text: "毛利率由 41% 提升至 46%", level: 0 },
          { id: "b2", text: "高价值客户留存率 88%", level: 0 },
          { id: "b3", text: "长尾客户流失需重点关注", level: 1 },
        ],
      },
      {
        id: "s6",
        layout: "content",
        title: "结论：下一季聚焦留存与毛利，而非盲目拉新",
        bullets: [
          { id: "b1", text: "预算向会员体系与续费运营倾斜", level: 0 },
          { id: "b2", text: "停止 ROI 低于 1.5 的获客渠道", level: 0 },
        ],
      },
      { id: "s7", layout: "closing", title: "感谢", bullets: [] },
    ],
  },
  {
    id: "product-narrative-darktech",
    name: "产品故事·张力叙事·暗黑科技",
    design: {
      mode: "narrative",
      visualStyle: "dark-tech",
      palette: "tech-purple",
    },
    slides: [
      {
        id: "s1",
        layout: "cover",
        title: "当数据离开本地，信任随之崩塌",
        bullets: [],
      },
      {
        id: "s2",
        layout: "content",
        title: "三年前，一次泄露让我们失去了最关键的客户",
        bullets: [
          { id: "b1", text: "核心研发文档在传输中被截获", level: 0 },
          { id: "b2", text: "我们意识到：加密不等于可控", level: 0 },
        ],
      },
      {
        id: "s3",
        layout: "section",
        title: "于是我们重写了对数据的全部假设",
        bullets: [],
      },
      {
        id: "s4",
        layout: "content",
        title: "端到端加密，只是故事的开始",
        bullets: [
          { id: "b1", text: "密钥永不离开用户设备", level: 0 },
          { id: "b2", text: "服务端即使被攻破也看不到明文", level: 0 },
        ],
      },
      {
        id: "s5",
        layout: "chart",
        title: "零信任架构让安全事件下降 94%",
        chart: {
          type: "bar",
          title: "年度安全事件数",
          data: [
            { label: "2021", value: 47 },
            { label: "2022", value: 18 },
            { label: "2023", value: 3 },
          ],
        },
      },
      {
        id: "s6",
        layout: "content",
        title: "今天，信任可以被验证，而不只是被承诺",
        bullets: [{ id: "b1", text: "开源审计 + 第三方渗透常态化", level: 0 }],
      },
      { id: "s7", layout: "closing", title: "把控制权，还给用户", bullets: [] },
    ],
  },
  {
    id: "training-instructional-soft",
    name: "新人培训·教学导向·柔和圆角",
    design: {
      mode: "instructional",
      visualStyle: "soft-rounded",
      palette: "minimal-white",
    },
    slides: [
      {
        id: "s1",
        layout: "cover",
        title: "三节课，学会写一封不被忽略的邮件",
        bullets: [],
      },
      {
        id: "s2",
        layout: "section",
        title: "本课目标：让对方 30 秒内读懂你的请求",
        bullets: [],
      },
      {
        id: "s3",
        layout: "content",
        title: "第一步：把结论写在第一行",
        bullets: [
          { id: "b1", text: "标题用动词，明确你要什么", level: 0 },
          { id: "b2", text: "首句给出结论，而非铺垫背景", level: 0 },
        ],
      },
      {
        id: "s4",
        layout: "content",
        title: "第二步：用三点支撑你的请求",
        bullets: [
          { id: "b1", text: "为什么重要", level: 0 },
          { id: "b2", text: "对方能得到什么", level: 0 },
          { id: "b3", text: "希望何时得到回复", level: 0 },
        ],
      },
      {
        id: "s5",
        layout: "two-column",
        title: "第三步：给一个低门槛的行动方式",
        bullets: [
          { id: "b1", text: "提供可点击的链接或模板", level: 0 },
          { id: "b2", text: "默认选项减少对方决策成本", level: 0 },
        ],
      },
      {
        id: "s6",
        layout: "content",
        title: "练习：改写一封你本周要发的邮件",
        bullets: [{ id: "b1", text: "用结论先行模板重新组织", level: 0 }],
      },
      {
        id: "s7",
        layout: "closing",
        title: "下节课：会议邀请怎么写",
        bullets: [],
      },
    ],
  },
  {
    id: "briefing-editorial-orange",
    name: "市场周报·中性通报·编辑杂志",
    design: {
      mode: "briefing",
      visualStyle: "editorial",
      palette: "vibrant-orange",
    },
    slides: [
      { id: "s1", layout: "cover", title: "本周市场动态简报", bullets: [] },
      {
        id: "s2",
        layout: "content",
        title: "行业：三件值得关注的事件",
        bullets: [
          { id: "b1", text: "头部厂商下调入门套餐价格", level: 0 },
          { id: "b2", text: "监管发布数据出境新规征求意见稿", level: 0 },
          { id: "b3", text: "某垂直赛道融资额环比回升", level: 0 },
        ],
      },
      {
        id: "s3",
        layout: "chart",
        title: "竞品价格波动集中在入门层级",
        chart: {
          type: "bar",
          title: "各档位均价变化(%)",
          data: [
            { label: "入门", value: -12 },
            { label: "标准", value: -2 },
            { label: "旗舰", value: 1 },
          ],
        },
      },
      {
        id: "s4",
        layout: "content",
        title: "我们：本周动作与影响",
        bullets: [
          { id: "b1", text: "上线自助续费入口，转化率 +8%", level: 0 },
          { id: "b2", text: "官网流量环比 +15%", level: 0 },
        ],
      },
      {
        id: "s5",
        layout: "content",
        title: "下周关注：新规落地时间表",
        bullets: [{ id: "b1", text: "跟踪意见反馈截止与正式稿发布", level: 0 }],
      },
      { id: "s6", layout: "closing", title: "详报见内部知识库", bullets: [] },
    ],
  },
  {
    id: "architecture-pyramid-blueprint",
    name: "技术架构复盘·结论先行·蓝图",
    design: {
      mode: "pyramid",
      visualStyle: "blueprint",
      palette: "business-blue",
    },
    slides: [
      { id: "s1", layout: "cover", title: "支付系统架构复盘", bullets: [] },
      { id: "s2", layout: "section", title: "核心结论", bullets: [] },
      {
        id: "s3",
        layout: "content",
        title: "拆分后稳定性提升，但一致性成本上升",
        bullets: [
          { id: "b1", text: "故障隔离率从 60% 提升至 92%", level: 0 },
          { id: "b2", text: "跨服务事务平均延迟 +40ms", level: 0 },
        ],
      },
      {
        id: "s4",
        layout: "chart",
        title: "可用性从 99.5% 提升到 99.95%",
        chart: {
          type: "line",
          title: "季度可用性(%)",
          data: [
            { label: "Q1", value: 99.5 },
            { label: "Q2", value: 99.7 },
            { label: "Q3", value: 99.95 },
          ],
        },
      },
      {
        id: "s5",
        layout: "two-column",
        title: "收益与代价需要被同样重视",
        bullets: [
          { id: "b1", text: "收益：单点故障不再拖垮全链路", level: 0 },
          { id: "b2", text: "代价：对账与补偿逻辑显著复杂", level: 0 },
        ],
      },
      {
        id: "s6",
        layout: "content",
        title: "建议：引入事务消息，回收一致性成本",
        bullets: [
          { id: "b1", text: "优先覆盖退款与结算链路", level: 0 },
          { id: "b2", text: "Q4 完成灰度", level: 0 },
        ],
      },
      { id: "s7", layout: "closing", title: "复盘完毕", bullets: [] },
    ],
  },
  {
    id: "launch-showcase-glass",
    name: "新品发布·展示极简·玻璃拟态",
    design: {
      mode: "showcase",
      visualStyle: "glassmorphism",
      palette: "tech-purple",
    },
    slides: [
      { id: "s1", layout: "cover", title: "Aurora 正式发布", bullets: [] },
      {
        id: "s2",
        layout: "content",
        title: "一块屏，承载你所有的创作",
        bullets: [{ id: "b1", text: "从灵感到成片，无需切换工具", level: 0 }],
      },
      {
        id: "s3",
        layout: "chart",
        title: "渲染速度提升 3 倍",
        chart: {
          type: "doughnut",
          title: "性能占比",
          data: [
            { label: "旧版", value: 33 },
            { label: "Aurora", value: 67 },
          ],
        },
      },
      {
        id: "s4",
        layout: "content",
        title: "12 万 创作者已在等待名单",
        bullets: [{ id: "b1", text: "首日预约转化率 41%", level: 0 }],
      },
      {
        id: "s5",
        layout: "content",
        title: "今天，开始你的第一段 Aurora",
        bullets: [{ id: "b1", text: "免费试用 14 天", level: 0 }],
      },
      { id: "s6", layout: "closing", title: "Aurora", bullets: [] },
    ],
  },
  {
    id: "guide-instructional-swiss",
    name: "操作指南·教学导向·瑞士极简",
    design: {
      mode: "instructional",
      visualStyle: "swiss-minimal",
      palette: "minimal-white",
    },
    slides: [
      {
        id: "s1",
        layout: "cover",
        title: "五分钟学会导出可印刷的 PDF",
        bullets: [],
      },
      {
        id: "s2",
        layout: "section",
        title: "你会学到：从画布到印刷厂的完整路径",
        bullets: [],
      },
      {
        id: "s3",
        layout: "content",
        title: "先选对尺寸与出血",
        bullets: [
          { id: "b1", text: "A4 留 3mm 出血", level: 0 },
          { id: "b2", text: "关闭自动缩放", level: 0 },
        ],
      },
      {
        id: "s4",
        layout: "content",
        title: "再嵌入所有字体",
        bullets: [
          { id: "b1", text: "避免印刷厂缺字替换", level: 0 },
          { id: "b2", text: "中文务必勾选子集嵌入", level: 0 },
        ],
      },
      {
        id: "s5",
        layout: "content",
        title: "最后检查色彩模式",
        bullets: [
          { id: "b1", text: "印刷用 CMYK 而非 RGB", level: 0 },
          { id: "b2", text: "导出后预览黑场是否过深", level: 0 },
        ],
      },
      { id: "s6", layout: "closing", title: "导出成功，送去打样", bullets: [] },
    ],
  },
];

export function getExamples(): GalleryExample[] {
  return EXAMPLES;
}
