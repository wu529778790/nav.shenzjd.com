/**
 * 左侧分类导航 Sidebar（2026-08-21 重构）
 *
 * 桌面端 sticky 固定在主区左侧，移动端通过顶栏切换按钮折叠显示。
 * 设计参考：luckman 补链营地 + 阿虚储物间—— 但做了切换式显示（一次只看一个分类），
 * 25 个分类 / 4378 条链接堆在同一长页会很乱，切换显示更清爽。
 *
 * Props:
 * - categories: 全部分类
 * - activeCategoryId: 当前选中的分类 id（由 HomeClient 持有）
 * - onCategoryChange: 切换分类回调
 */

"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { visibleCategories } from "@/lib/utils/tombstone";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Category } from "@/types";

interface SidebarProps {
  categories: Category[];
  activeCategoryId: string | null;
  onCategoryChange: (categoryId: string) => void;
  /** 移动端是否强制折叠（外部控制） */
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({
  categories,
  activeCategoryId,
  onCategoryChange,
  mobileOpen,
  onMobileClose,
}: SidebarProps) {
  const visible = visibleCategories(categories);
  const active = visible.find((c) => c.id === activeCategoryId) ?? visible[0];

  // 桌面端折叠态（窄屏隐藏为图标列）
  const [collapsed, setCollapsed] = useState(false);

  // ESC 关闭移动端抽屉
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onMobileClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen, onMobileClose]);

  if (visible.length === 0) return null;

  const nav = (
    <nav
      aria-label="分类导航"
      className="flex h-full min-h-0 flex-col gap-0.5 overflow-y-auto py-3"
    >
      {visible.map((cat) => {
        const isActive = cat.id === active?.id;
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onCategoryChange(cat.id)}
            className={cn(
              "group flex w-full cursor-pointer items-center gap-2 rounded-[var(--radius-md)] px-2.5 py-2 text-left text-sm transition-colors",
              isActive
                ? "bg-[var(--primary-600)]/10 font-medium text-[var(--primary-700)]"
                : "text-[var(--foreground-secondary)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]",
              collapsed && "justify-center px-2"
            )}
            title={cat.name}
          >
            <span className="flex-shrink-0 text-base leading-none">{cat.icon || "📁"}</span>
            {!collapsed && (
              <>
                <span className="min-w-0 flex-1 truncate">{cat.name}</span>
                <span
                  className={cn(
                    "flex-shrink-0 text-xs tabular-nums",
                    isActive
                      ? "text-[var(--primary-600)]"
                      : "text-[var(--muted-foreground)]"
                  )}
                >
                  {cat.sites.length}
                </span>
              </>
            )}
          </button>
        );
      })}
    </nav>
  );

  // 桌面端：sticky 左列（窄屏可折叠为图标）
  return (
    <>
      {/* 桌面端 */}
      <aside
        className={cn(
          "sticky top-16 hidden h-[calc(100vh-4rem)] flex-shrink-0 border-r border-[var(--border)] bg-[var(--background)] transition-all duration-200 md:block",
          collapsed ? "w-14" : "w-64"
        )}
      >
        <div className="relative flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
            {!collapsed && (
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                分类目录
              </h2>
            )}
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              className="rounded-[var(--radius-sm)] p-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
              aria-label={collapsed ? "展开侧栏" : "折叠侧栏"}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
          </div>
          <div className="flex-1 overflow-hidden px-2">{nav}</div>
        </div>
      </aside>

      {/* 移动端：抽屉式 */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-[60] md:hidden"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-black/40"
            onClick={onMobileClose}
            aria-label="关闭分类导航"
          />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-[var(--border)] bg-[var(--background)] shadow-xl">
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
                <h2 className="text-sm font-semibold">分类目录</h2>
                <button
                  type="button"
                  onClick={onMobileClose}
                  className="rounded-[var(--radius-sm)] p-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                  aria-label="关闭"
                >
                  ✕
                </button>
              </div>
              <div className="flex-1 overflow-hidden px-2">{nav}</div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}