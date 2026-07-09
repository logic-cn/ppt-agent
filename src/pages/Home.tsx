import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Presentation, Plus, FileText, Settings, Clock } from "lucide-react";
import { useDeckStore } from "@/store/deck";
import { useProjectStore } from "@/store/project";

export default function Home() {
  const navigate = useNavigate();
  const createDeck = useDeckStore((s) => s.createDeck);
  const { recent, loading, loadRecent } = useProjectStore();

  useEffect(() => {
    void loadRecent();
  }, [loadRecent]);

  const createProject = async () => {
    const deck = await createDeck();
    navigate(`/editor/${deck.id}?new=1`);
  };

  const getSlideSummary = (slides: unknown[]) => `${slides.length} 页`;

  return (
    <div className="flex h-full flex-col">
      {/* 顶栏 */}
      <header className="flex items-center justify-between border-b border-border bg-bg-surface px-6 py-3">
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
              className="group flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-bg-surface p-8 transition hover:border-accent hover:bg-bg-elevated"
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
              className="group flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-bg-surface p-8 transition hover:border-accent hover:bg-bg-elevated"
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

            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-text-muted">
              更多能力
              <br />
              即将上线
            </div>
          </div>

          {/* 最近项目 */}
          <h2 className="mb-4 text-lg font-semibold">最近项目</h2>
          {loading ? (
            <div className="flex items-center justify-center py-16 text-text-muted">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              <span className="ml-3 text-sm">加载中…</span>
            </div>
          ) : recent.length === 0 ? (
            <div className="rounded-lg border border-border bg-bg-surface p-8">
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
              <div className="mt-6 rounded-md bg-bg-elevated px-4 py-3 text-sm text-text-muted">
                💡 提示：先去设置页填写你的 API Key，才能使用 AI 生成功能
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {recent.map((p) => (
                <button
                  key={p.id}
                  onClick={() => navigate(`/editor/${p.id}`)}
                  className="group rounded-xl border border-border bg-bg-surface p-5 text-left transition hover:border-accent hover:shadow-md"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft/50">
                      <FileText className="h-5 w-5 text-accent" />
                    </div>
                    <span className="rounded-md bg-bg-elevated px-2 py-0.5 text-xs text-text-muted">
                      {getSlideSummary(p.slides)}
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
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
