/**
 * 应用头部组件（重构版）
 * 拆分为多个子组件，职责清晰
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { SyncStatus } from "@/components/SyncStatus";
import { Button } from "@/components/ui/button";
import { Github, Star, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { clearAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/toast";
import { getRuntimePublicConfig, type RuntimePublicConfig } from "@/lib/runtime-public-config";

// 子组件
import { SyncProgressBar } from "./AppHeader/SyncProgressBar";
import { OfflineBanner } from "./AppHeader/OfflineBanner";
import { UserMenu } from "./AppHeader/UserMenu";
import { SettingsDialog } from "./AppHeader/SettingsDialog";

export function AppHeader() {
  const { authUser } = useAuth();
  const [syncStep] = useState<import("@/types").SyncStepInfo | null>(null);
  const { showToast } = useToast();

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
  const [githubClientId, setGithubClientId] = useState("");
  const [runtimeConfigLoaded, setRuntimeConfigLoaded] = useState(false);
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
      const params = new URLSearchParams(window.location.search);
      const oauthError = params.get("oauth_error");
      const oauthSuccess = params.get("oauth_success");

      if (oauthError) {
        showToast(`登录失败: ${oauthError}`, "error");
        window.history.replaceState({}, "", window.location.pathname);
      }

      const loadedRuntimeConfig = await getRuntimePublicConfig().catch(() => null);
      if (loadedRuntimeConfig) {
        setRuntimeConfig(loadedRuntimeConfig);
        setGithubClientId(loadedRuntimeConfig.githubClientId);
      }
      setRuntimeConfigLoaded(true);

      if (oauthSuccess) {
        showToast("登录成功", "success");
        window.history.replaceState({}, "", window.location.pathname);
        window.dispatchEvent(new Event("auth-update"));
      }
    })();
  }, [showToast]);

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
  const handleGitHubLogin = async () => {
    let clientId = githubClientId;
    if (!clientId) {
      const loadedRuntimeConfig = await getRuntimePublicConfig().catch(() => null);
      if (!loadedRuntimeConfig) {
        setRuntimeConfigLoaded(true);
        showToast("运行时配置加载失败，请稍后重试", "error");
        return;
      }

      setRuntimeConfig(loadedRuntimeConfig);
      clientId = loadedRuntimeConfig.githubClientId;
      setGithubClientId(loadedRuntimeConfig.githubClientId);
      setRuntimeConfigLoaded(true);
    }

    if (!clientId) {
      showToast("请配置 NEXT_PUBLIC_GITHUB_CLIENT_ID 环境变量", "error");
      return;
    }

    // 直接跳转 GitHub OAuth，不做前置确认弹窗
    window.location.href = "/api/auth/github/login";
  };

  // 退出登录处理
  const handleGitHubLogout = () => {
    if (confirm("确定要退出登录吗？")) {
      void (async () => {
        await clearAuth();
        window.dispatchEvent(new Event("auth-update"));
        window.location.reload();
      })();
    }
  };

  return (
    <>
      {/* 同步进度条 */}
      <SyncProgressBar step={syncStep} />

      {/* 离线提示（仅客户端挂载后检测网络状态，避免 SSR/CSR 不一致） */}
      {mounted && <OfflineBanner isOnline={navigator.onLine} />}

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

            {/* GitHub Star 按钮 */}
            <a
              href={`https://github.com/${runtimeConfig?.githubOwner || "wu529778790"}/${runtimeConfig?.githubRepo || "navhub.shenzjd.com"}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background-secondary)] px-3 py-1.5 text-sm font-semibold text-[var(--foreground-secondary)] transition-colors hover:border-[var(--primary-300)] hover:text-[var(--primary-700)] sm:flex"
            >
              <Star className="h-4 w-4 text-[var(--accent-600)]" />
              Star
            </a>

            {/* 用户菜单或登录按钮 */}
            {authUser ? (
              <UserMenu
                authUser={authUser}
                onOpenSettings={() => setShowSettingsModal(true)}
                onLogout={handleGitHubLogout}
                runtimeConfig={runtimeConfig}
              />
            ) : (
              <Button
                size="sm"
                onClick={() => void handleGitHubLogin()}
                disabled={!runtimeConfigLoaded && !githubClientId}
                className="gap-2 shadow-md transition-all hover:shadow-lg"
              >
                <Github className="h-4 w-4" />
                登录
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* 设置对话框 */}
      <SettingsDialog
        open={showSettingsModal}
        onOpenChange={setShowSettingsModal}
        authUser={authUser}
        onLogout={handleGitHubLogout}
        runtimeConfig={runtimeConfig}
      />
    </>
  );
}
