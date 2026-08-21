/**
 * 应用头部组件（纯只读展示版，2026-08-21 重构）
 * Logo + GitHub 仓库链接 + 关于信息。
 * 搜索框在 HomeClient 顶部（聚焦当前分类），这里不再重复。
 */

"use client";

import { Github, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { getRuntimePublicConfig, type RuntimePublicConfig } from "@/lib/runtime-public-config";
import { useState, useEffect } from "react";

export function AppHeader() {
  const [showAbout, setShowAbout] = useState(false);
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimePublicConfig | null>(null);

  // 初始化运行时配置
  useEffect(() => {
    void (async () => {
      const loadedRuntimeConfig = await getRuntimePublicConfig().catch(() => null);
      if (loadedRuntimeConfig) {
        setRuntimeConfig(loadedRuntimeConfig);
      }
    })();
  }, []);

  return (
    <>
      {/* 主导航栏 */}
      <header className="glass sticky top-0 z-[45] w-full border-b border-[var(--border)]">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-4 md:px-6">
          {/* Logo */}
          <div
            className="flex cursor-pointer items-center gap-3"
            onClick={() => (window.location.href = "/")}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--primary-600)] text-lg font-bold text-white shadow-[var(--shadow-sm)]">
              N
            </div>
            <h1 className="text-xl font-extrabold tracking-tight text-gradient">NavHub</h1>
          </div>

          {/* 右侧操作区 */}
          <div className="flex items-center gap-2">
            {/* GitHub 仓库链接 */}
            <a
              href={`https://github.com/${runtimeConfig?.githubOwner || "wu529778790"}/${runtimeConfig?.githubRepo || "navhub.shenzjd.com"}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub 仓库"
              className="hidden items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background-secondary)] p-1.5 text-[var(--foreground-secondary)] transition-colors hover:border-[var(--primary-300)] hover:text-[var(--primary-700)] sm:flex"
            >
              <Github className="h-4 w-4" />
            </a>

            {/* 关于按钮 */}
            <button
              type="button"
              onClick={() => setShowAbout(!showAbout)}
              className={cn(
                "rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background-secondary)] p-1.5 text-[var(--foreground-secondary)] transition-colors hover:border-[var(--primary-300)] hover:text-[var(--primary-700)]"
              )}
              aria-label="关于 NavHub"
              aria-expanded={showAbout}
            >
              <Info className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* 关于弹层 */}
      {showAbout && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowAbout(false)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full max-w-sm rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--background-secondary)] p-6 shadow-[var(--shadow-lg)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-2 text-lg font-semibold">NavHub</h2>
            <p className="text-sm text-[var(--muted-foreground)]">
              聚合 4000+ 优质链接的导航站：影视、阅读、工具、AI、资源搜索等。
              <br />
              <br />
              数据由 <strong>navdata</strong> 工具链爬取维护（luckman 补给营地 + 阿虚同学的储物间），
              存储于 Turso 数据库，本站为纯只读展示。
            </p>
            <button
              type="button"
              onClick={() => setShowAbout(false)}
              className="mt-4 w-full cursor-pointer rounded-[var(--radius-md)] bg-[var(--primary-600)] py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--primary-700)]"
            >
              知道了
            </button>
          </div>
        </div>
      )}
    </>
  );
}
