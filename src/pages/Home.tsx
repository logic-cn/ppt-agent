import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Presentation,
  Plus,
  FileText,
  Settings,
  Clock,
  Trash2,
  LayoutTemplate,
} from "lucide-react";
import { useDeckStore } from "@/store/deck";
import { useQualityStore } from "@/store/quality";
import { useProjectStore } from "@/store/project";
import {
  deleteDeck,
  createDeckFromTemplate,
  saveDeck,
  createEmptyDeck,
} from "@/services/storage";
import { generateOutline } from "@/services/outline";
import { DEFAULT_THEME_ID } from "@/themes";
import type { TemplateSelectResult } from "@/components/template-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DEFAULT_DESIGN } from "@/types/design";
import { TemplateDialog } from "@/components/template-dialog";

export default function Home() {
  const navigate = useNavigate();
  const createDeck = useDeckStore((s) => s.createDeck);
  const { recent, loading, loadRecent } = useProjectStore();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);

  useEffect(() => {
    void loadRecent();
    const onShow = () => void loadRecent();
    window.addEventListener("pageshow", onShow);
    window.addEventListener("focus", onShow);
    return () => {
      window.removeEventListener("pageshow", onShow);
      window.removeEventListener("focus", onShow);
    };
  }, [loadRecent]);

  const createProject = async () => {
    const deck = await createDeck();
    navigate(`/editor/${deck.id}?new=1`);
  };

  const handleTemplateSelect = async (result: TemplateSelectResult) => {
    setTemplateDialogOpen(false);

    if (result.mode === "static") {
      const deck = createDeckFromTemplate(
        {
          id: result.pack.id,
          name: result.pack.name,
          description: result.pack.description,
          scenario: result.pack.scenario,
          suggestedPageCount: result.pack.slides.length,
          slides: result.pack.slides,
        },
        result.topic,
      );
      await saveDeck(deck);
      useDeckStore.setState({ deck, dirty: false, past: [], future: [] });
      useQualityStore
        .getState()
        .setPendingRules(result.pack.qualityRules ?? []);
      navigate(`/editor/${deck.id}?from=template`);
      return;
    }

    try {
      const slides = await generateOutline({
        topic: result.topic,
        pageCount: result.pack.slides.length,
        design: { ...DEFAULT_DESIGN, templateId: result.pack.id },
      });
      const now = Date.now();
      const deck = {
        ...createEmptyDeck(result.topic),
        title: result.topic,
        slides,
        themeId: DEFAULT_THEME_ID,
        createdAt: now,
        updatedAt: now,
      };
      await saveDeck(deck);
      useDeckStore.setState({ deck, dirty: false, past: [], future: [] });
      useQualityStore
        .getState()
        .setPendingRules(result.pack.qualityRules ?? []);
      navigate(`/editor/${deck.id}?from=template-ai`);
    } catch (e) {
      console.error("模板 AI 生成失败:", e);
      alert("AI 生成失败，请重试或选择直接创建");
    }
  };

  const getSlideSummary = (slidesCount: number) => `${slidesCount} 页`;

  return (
    <div className="flex h-full flex-col">
      {/* 顶栏 */}
      <header className="flex items-center justify-between border-b border-border bg-white px-6 py-3">
        <div className="flex items-center gap-2">
          <Presentation className="h-5 w-5 text-accent" />
          <span className="text-lg font-semibold">PPT Agent</span>
        </div>
        <button
          onClick={() => navigate("/settings")}
          className="text-text-secondary hover:text-text-primary"
        >
          <Settings className="h-5 w-5" />
        </button>
      </header>

      {/* 主体 */}
      <main className="flex-1 overflow-auto px-12 py-10">
        <div className="mx-auto max-w-5xl">
          {/* 新建入口 */}
          <h1 className="mb-6 text-2xl font-semibold">开始制作</h1>
          <div className="mb-12 grid grid-cols-3 gap-4">
            <button
              onClick={createProject}
              className="group flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-white p-8 transition-all hover:border-accent hover:shadow-sm"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent transition group-hover:scale-110">
                <Plus className="h-7 w-7" />
              </div>
              <div className="text-center">
                <div className="font-medium">新建空白项目</div>
                <div className="mt-1 text-sm text-text-muted">
                  从主题开始生成
                </div>
              </div>
            </button>

            <button
              onClick={async () => {
                const deck = await createDeck();
                navigate(`/editor/${deck.id}?import=1`);
              }}
              className="group flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-white p-8 transition-all hover:border-accent hover:shadow-sm"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent transition group-hover:scale-110">
                <FileText className="h-7 w-7" />
              </div>
              <div className="text-center">
                <div className="font-medium">导入文档</div>
                <div className="mt-1 text-sm text-text-muted">
                  Word / Markdown / URL
                </div>
              </div>
            </button>

            <button
              onClick={() => setTemplateDialogOpen(true)}
              className="group flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-white p-8 transition-all hover:border-accent hover:shadow-sm"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent transition group-hover:scale-110">
                <LayoutTemplate className="h-7 w-7" />
              </div>
              <div className="text-center">
                <div className="font-medium">从模板创建</div>
                <div className="mt-1 text-sm text-text-muted">
                  精选模板快速开始
                </div>
              </div>
            </button>
          </div>

          {/* 最近项目 */}
          <h2 className="mb-4 text-lg font-semibold">最近项目</h2>
          {loading ? (
            <div className="flex items-center justify-center py-16 text-text-muted">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              <span className="ml-3 text-sm">加载中…</span>
            </div>
          ) : recent.length === 0 ? (
            <div className="rounded-xl border border-border bg-white p-8">
              <h2 className="mb-4 text-lg font-semibold">快速开始</h2>
              <div className="grid grid-cols-3 gap-6">
                <div className="space-y-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent">
                    1
                  </div>
                  <h3 className="font-medium">填写主题</h3>
                  <p className="text-sm text-text-muted">
                    点击「新建空白项目」→ 在右侧 AI 面板输入 PPT 主题
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent">
                    2
                  </div>
                  <h3 className="font-medium">调整大纲</h3>
                  <p className="text-sm text-text-muted">
                    左侧拖拽排序、编辑标题、切换页面布局
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent">
                    3
                  </div>
                  <h3 className="font-medium">导出 PPT</h3>
                  <p className="text-sm text-text-muted">
                    预览满意后，点击「导出 PPT」下载 .pptx 文件
                  </p>
                </div>
              </div>
              <div className="mt-6 rounded-md bg-bg-surface px-4 py-3 text-sm text-text-muted">
                💡 提示：先去设置页填写你的 API Key，才能使用 AI 生成功能
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {recent.map((p) => (
                <div
                  key={p.id}
                  className="group relative rounded-xl border border-border bg-white p-5 text-left transition-all hover:border-accent hover:shadow-sm"
                >
                  <button
                    onClick={() => navigate(`/editor/${p.id}`)}
                    className="w-full text-left"
                  >
                    <div className="mb-3 flex items-start justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft/50">
                        <FileText className="h-5 w-5 text-accent" />
                      </div>
                      <span className="rounded-md bg-bg-surface px-2 py-0.5 text-xs text-text-muted">
                        {getSlideSummary(p.slidesCount)}
                      </span>
                    </div>
                    <h3 className="mb-1 truncate font-medium text-text-primary group-hover:text-accent">
                      {p.title}
                    </h3>
                    <p className="flex items-center gap-1 text-xs text-text-muted">
                      <Clock className="h-3 w-3" />
                      {new Date(p.updatedAt).toLocaleDateString("zh-CN")}
                    </p>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(p.id);
                    }}
                    className="absolute right-2 top-2 rounded-md p-1.5 text-text-muted opacity-0 transition hover:bg-danger/10 hover:text-danger group-hover:opacity-100"
                    title="删除项目"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <TemplateDialog
            open={templateDialogOpen}
            onClose={() => setTemplateDialogOpen(false)}
            onSelect={handleTemplateSelect}
          />

          <ConfirmDialog
            open={deleteTarget !== null}
            title="删除项目"
            message="确定要删除这个项目吗？此操作不可撤销。"
            confirmText="删除"
            onConfirm={async () => {
              if (deleteTarget) {
                await deleteDeck(deleteTarget);
                setDeleteTarget(null);
                void loadRecent();
              }
            }}
            onCancel={() => setDeleteTarget(null)}
          />
        </div>
      </main>
    </div>
  );
}
