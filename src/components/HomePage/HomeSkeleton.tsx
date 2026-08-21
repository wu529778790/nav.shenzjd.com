/**
 * 首页加载中骨架屏
 */

export function HomeSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="内容加载中">
      {[0, 1].map((i) => (
        <div key={i} className="space-y-3">
          {/* 分类标题 */}
          <div className="h-6 w-28 rounded-md bg-[var(--muted)]" />
          {/* 卡片网格 */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {[0, 1, 2].map((j) => (
              <div
                key={j}
                className="flex h-24 flex-col items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--background-elevated)] p-3"
              >
                <div className="h-10 w-10 rounded-lg bg-[var(--muted)]" />
                <div className="h-3 w-16 rounded bg-[var(--muted)]" />
                <div className="h-2 w-20 rounded bg-[var(--muted)]" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
