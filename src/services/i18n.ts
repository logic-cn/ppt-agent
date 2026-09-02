const en: { [key: string]: string } = {
  appName: "PPT Agent",
  settings: "Settings",
  close: "Close",
  darkMode: "Dark Mode",
  lightMode: "Light Mode",
  exportPPT: "Export PPT",
  exporting: "Exporting…",
  exportSuccess: "Export successful",
  exportFailed: "Export failed",
  error: "Error",
  warning: "Warning",
  success: "Success",
  info: "Info",
  cancel: "Cancel",
  confirm: "Confirm",
  save: "Save",
  saving: "Saving…",
  settingsSaved: "Settings saved",
  openFile: "Open File",
  import_: "Import",
  importFromWord: "Import from Word",
  importFromMarkdown: "Import from Markdown",
  newProject: "New Project",
  recentProjects: "Recent Projects",
  noProjects: "No projects yet",
  generateOutline: "Generate Outline",
  generating: "Generating…",
  outlineGenerated: "Outline generated",
  editor: "Editor",
  preview: "Preview",
  slideRedraw: "Redraw Slide",
  redrawSync: "Redraw Sync",
  redrawFailed: "Redraw failed",
  retry: "Retry",
  empty: "No content",
  copy: "Copy",
  paste: "Paste",
  undo: "Undo",
  redo: "Redo",
  theme: "Theme",
  themeBusinessDeep: "Business Deep Blue",
  themeMinimalist: "Minimalist White",
  themeTechPurple: "Tech Purple",
  themeVibrantOrange: "Vibrant Orange",
  chartQualityGate: "Chart Quality Gate",
  svgStale: "SVG Outdated",
  redrawNeeded:
    "Content modified, preview outdated. Click 'Redraw Sync' to update.",
  pages: "Pages",
  slide: "Slide",
  of: "of",
  // Dashboard / Home
  dashboard: "Dashboard",
  newDeck: "New Deck",
  // Common
  submit: "Submit",
  reset: "Reset",
  loading: "Loading",
  loaded: "Loaded",
  // Toast / Notification
  toastDefault: "Default toast",
  toastSuccess: "Success toast",
  toastError: "Error toast",
  toastWarning: "Warning toast",
  // Form
  required: "Required",
  optional: "Optional",
  // Slider / Control
  sliderValue: "Slider value:",
};
const zh: { [key: string]: string } = {
  appName: "PPT 代理",
  settings: "设置",
  close: "关闭",
  darkMode: "深色模式",
  lightMode: "浅色模式",
  exportPPT: "导出 PPT",
  exporting: "正在导出…",
  exportSuccess: "导出成功",
  exportFailed: "导出失败",
  error: "错误",
  warning: "警告",
  success: "成功",
  info: "信息",
  cancel: "取消",
  confirm: "确认",
  save: "保存",
  saving: "保存中…",
  settingsSaved: "设置已保存",
  openFile: "打开文件",
  import_: "导入",
  importFromWord: "导入 Word",
  importFromMarkdown: "导入 Markdown",
  newProject: "新建项目",
  recentProjects: "最近项目",
  noProjects: "暂无项目",
  generateOutline: "生成大纲",
  generating: "生成中…",
  outlineGenerated: "大纲已生成",
  editor: "大纲编辑器",
  preview: "预览模式",
  slideRedraw: "重画页",
  redrawSync: "重画同步",
  redrawFailed: "重画失败",
  retry: "重试",
  empty: "暂无内容",
  copy: "复制",
  paste: "粘贴",
  undo: "撤销",
  redo: "重做",
  theme: "主题",
  themeBusinessDeep: "商务深蓝",
  themeMinimalist: "极简白",
  themeTechPurple: "科技紫",
  themeVibrantOrange: "活力橙",
  chartQualityGate: "图表质量闸门",
  svgStale: "SVG 过期",
  redrawNeeded: "内容已修改，预览为旧版本。点击‘重画同步’以更新。",
  pages: "页数",
  slide: "页",
  of: "共",
  // Dashboard / Home
  dashboard: "仪表盘",
  newDeck: "新建演示文稿",
  // Common
  submit: "提交",
  reset: "重置",
  loading: "加载中",
  loaded: "已加载",
  // Toast / Notification
  toastDefault: "默认提示",
  toastSuccess: "成功提示",
  toastError: "错误提示",
  toastWarning: "警告提示",
  // Form
  required: "必填",
  optional: "可选",
  // Slider / Control
  sliderValue: "滑块数值:",
};

type Lang = "en" | "zh";

let currentLang: Lang = "zh";

export function setLang(lang: Lang) {
  currentLang = lang;
}

function t(key: string): string {
  return (currentLang === "en" ? en : zh)[key] || key;
}

export function useLang(): Lang {
  return currentLang;
}

export { t };

export default { t, setLang, useLang, en, zh };
