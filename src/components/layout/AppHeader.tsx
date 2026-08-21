/**
 * 应用头部组件（重构版）
 * 拆分为多个子组件，职责清晰
 *
 * 全站私有模式（2026-08-21 起）：无登录/登出，右上角为设置入口。
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { SyncStatus } from "@/components/SyncStatus";
import { Button } from "@/components/ui/button";
import { Github, Search, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { getRuntimePublicConfig, type RuntimePublicConfig } from "@/lib/runtime-public-config";

// 子组件
import { SyncProgressBar } from "./AppHeader/SyncProgressBar";
import { SettingsDialog } from "./AppHeader/SettingsDialog";

export function AppHeader() {
  const [syncStep] = useState<import("@/types").SyncStepInfo | null>(null);

  // 搜索框状态
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 搜索: 通过全局事件通知 page.tsx
  useEffect(() => {
    if (searchQuery === undefined) return;
    window.dispatchEvent(new CustomEvent("global-search", { detail: searchQuery }));
  }, [searchQuery]);

  // 监听全局清除搜索事件
  useEffect(() => {
    const handleClearSearch = () => {
      setSearchQuery("");
    };
    window.addEventListener("clear-global-search", handleClearSearch);
    return () => window.removeEventListener("clear-global-search", handleClearSearch);
  }, []);

  // 状态管理
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimePublicConfig | null>(null);

  // mounted 保护: 避免 SSR hydration mismatch
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 客户端挂载标记，避免 SSR/CSR 渲染不一致
    setMounted(true);
  }, []);

  // 初始化运行时配置
  useEffect(() => {
    void (async () => {
      const loadedRuntimeConfig = await getRuntimePublicConfig().catch(() => null);
      if (loadedRuntimeConfig) {
        setRuntimeConfig(loadedRuntimeConfig);
      }
    })();
  }, []);

  // 监听 open-settings 事件
  useEffect(() => {
    const handleOpenSettings = () => setShowSettingsModal(true);
    window.addEventListener("open-settings", handleOpenSettings);
    return () => window.removeEventListener("open-settings", handleOpenSettings);
  }, []);

  // 全局搜索快捷键 ⌘K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      {/* 同步进度条 */}
      <SyncProgressBar step={syncStep} />

      {/* 主导航栏 */}
      <header
        className="glass sticky top-0 z-[45] w-full border-b border-[var(--border)]"
        style={{ marginTop: mounted && syncStep ? "60px" : "0px" }}
      >
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
            {/* 全局搜索框 */}
            <div
              className={cn(
                "relative flex items-center transition-all duration-200",
                isSearchFocused ? "w-64 sm:w-72" : "w-40 sm:w-48"
              )}
            >
              <div className={cn(
                "flex items-center w-full rounded-[var(--radius-md)] border px-2.5 transition-all duration-200",
                isSearchFocused
                  ? "border-[var(--primary-400)] bg-[var(--background-elevated)] shadow-[var(--shadow-sm)]"
                  : "border-[var(--border)] bg-[var(--background-secondary)] hover:border-[var(--border-strong)]"
              )}>
                <Search className="h-3.5 w-3.5 text-[var(--muted-foreground)] flex-shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                  placeholder="搜索站点..."
                  aria-label="全局搜索"
                  autoComplete="off"
                  className="ml-1.5 w-full bg-transparent py-1.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="flex-shrink-0 cursor-pointer p-0.5 text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                    type="button"
                    aria-label="清除搜索"
                  >
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                )}
              </div>
              <kbd className="pointer-events-none absolute right-2 hidden rounded border border-[var(--border)] bg-[var(--background-secondary)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--muted-foreground)] sm:inline-block">⌘K</kbd>
            </div>

            <SyncStatus />

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

            {/* 全站私有：设置入口 */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowSettingsModal(true)}
              className="gap-2"
              aria-label="打开设置"
            >
              <Settings className="h-4 w-4" />
              设置
            </Button>
          </div>
        </div>
      </header>

      {/* 设置对话框 */}
      <SettingsDialog open={showSettingsModal} onOpenChange={setShowSettingsModal} />
    </>
  );
}
