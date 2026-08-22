/**
 * 深浅色模式切换按钮（2026-08-22）
 *
 * 主题状态由 <html data-theme> 驱动（layout.tsx 内联脚本在 hydration 前初始化，
 * 读取 localStorage["theme"]，缺省跟随系统 prefers-color-scheme）。
 */

"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 挂载时同步主题（SSR 无法惰性初始化）
    setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // 隐私模式等场景忽略
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "切换到浅色模式" : "切换到深色模式"}
      title={theme === "dark" ? "切换到浅色模式" : "切换到深色模式"}
      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background-secondary)] text-[var(--foreground-secondary)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
