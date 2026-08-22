/**
 * 左侧树形导航 Sidebar（2026-08-21 树形导航站重构）
 *
 * 交互规格（用户拍板）：
 * - 整行都是热区：点击任意位置 = 展开/折叠（分类）或跳转（站点）
 * - 图标即类型：文件夹图标 = 分类（可下拐进入下一层）；链接图标 = 站点叶子（直达跳转）
 * - 同一层图标一致：子分类层全是文件夹，站点层全是链接
 * - 当前节点：黑底白字 + 黄文件夹；祖先：SemiBold 深色
 * - 自动展开当前节点的祖先链
 */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { stripTopPrefix } from "@/lib/format";
import type { Category, Site } from "@/types";

/* ============ 图标 ============ */

/** 文件夹图标（分类可下拐） */
export function FolderIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <path
        d="M3 6.5C3 5.67 3.67 5 4.5 5H9.5L11.5 7H19.5C20.33 7 21 7.67 21 8.5V17.5C21 18.33 20.33 19 19.5 19H4.5C3.67 19 3 18.33 3 17.5V6.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** 链接图标（站点叶子直达） */
export function LinkIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <path d="M10 14L14 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M11 6.5L14 3.5C15.5 2 18 2 19.5 3.5C21 5 21 7.5 19.5 9L16.5 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M13 17.5L10 20.5C8.5 22 6 22 4.5 20.5C3 19 3 16.5 4.5 15L7.5 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ============ 树工具 ============ */

interface SidebarProps {
  categories: Category[];
  activeCategoryId: string | null;
  onCategoryChange: (categoryId: string) => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  /** 移动端全屏展示模式（不通过抽屉触发，占满首屏直接显示 tree），2026-08-22 用户拍板 */
  mobileAlwaysOpen?: boolean;
}

/** 计算节点下挂的站点总数（含子孙） */
function countDescendantSites(node: Category): number {
  let n = node.sites.length;
  for (const c of node.children ?? []) n += countDescendantSites(c);
  return n;
}

/* ============ 树节点行 ============ */

function CategoryRow({
  node,
  depth,
  activeCategoryId,
  expanded,
  onToggle,
  onSelect,
  showSites,
  topIndex,
}: {
  node: Category;
  depth: number;
  activeCategoryId: string | null;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  /** 是否展示站点叶子链接：PC 端右侧已展示 → false；移动端无右侧 → true */
  showSites: boolean;
  /** 顶级分类在顶级数组中的下标（0-based），depth===0 时用于按索引生成编号 */
  topIndex?: number;
}) {
  const hasChildren = (node.children?.length ?? 0) > 0;
  const isActive = node.id === activeCategoryId;
  const isExpanded = expanded.has(node.id);
  const totalSites = countDescendantSites(node);

  return (
    <div>
      {/* 整行热区：分类 → 选中/进入 + 切换展开；文件夹图标表示可下拐 */}
      <button
        type="button"
        onClick={() => {
          // 已是当前分类 → 折叠；否则 → 选中并展开
          if (node.id === activeCategoryId) {
            onToggle(node.id);
          } else {
            onSelect(node.id);
            if (!isExpanded) onToggle(node.id);
          }
        }}
        aria-expanded={hasChildren ? isExpanded : undefined}
        title={node.name}
        className={cn(
          "group flex w-full cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] px-2 py-[7px] text-left text-sm transition-colors duration-100",
          isActive
            ? "bg-[var(--neutral-900)] text-white"
            : "text-[var(--foreground-secondary)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]",
          depth > 0 && "pl-[calc(0.5rem+1.5rem)]"
        )}
        style={{ paddingLeft: `${8 + depth * 24}px` }}
      >
        <span
          className={cn(
            "flex h-4 w-4 flex-shrink-0 items-center justify-center",
            isActive ? "text-[var(--accent-500)]" : "text-[var(--accent-500)]"
          )}
        >
          <FolderIcon className="h-4 w-4" />
        </span>

        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            isActive ? "font-medium text-white" : depth === 0 ? "font-medium" : ""
          )}
        >
          {depth === 0 ? (
            <>
              {/* 编号固定 2ch 宽（等宽数字 + 右对齐），名字永远从同一起点开始 */}
              <span className="mr-1.5 inline-block w-[2ch] text-right font-mono tabular-nums">
                {String((topIndex ?? 0) + 1).padStart(2, "0")}
              </span>
              {stripTopPrefix(node.name)}
            </>
          ) : (
            node.name
          )}
        </span>

        {totalSites > 0 && (
          <span
            className={cn(
              "flex-shrink-0 text-[11px] tabular-nums",
              isActive ? "text-[var(--neutral-400)]" : "text-[var(--muted-foreground)]"
            )}
          >
            {totalSites}
          </span>
        )}
      </button>

      {/* 子分类（展开时递归）——有 children 的分类：树里只展示子分类（文件夹层），自身站点在主区展示 */}
      {hasChildren && isExpanded && (
        <div className="space-y-0.5">
          {node.children!.map((child) => (
            <CategoryRow
              key={child.id}
              node={child}
              depth={depth + 1}
              activeCategoryId={activeCategoryId}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
              showSites={showSites}
            />
          ))}
        </div>
      )}

      {/* 站点叶子（叶子分类展开时显示，链接图标直跳）——PC 端 showSites=false 不展示（右侧已有）；移动端 showSites=true 展示 */}
      {showSites && !hasChildren && node.sites.length > 0 && isExpanded && (
        <div className="space-y-0.5">
          {node.sites.map((site) => (
            <SiteRow
              key={site.id}
              site={site}
              depth={depth + 1}
              activeCategoryId={activeCategoryId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** 站点叶子行：链接图标 + 标题，点击直接跳转 */
function SiteRow({
  site,
  depth,
  activeCategoryId,
}: {
  site: Site;
  depth: number;
  activeCategoryId: string | null;
}) {
  return (
    <a
      href={site.url}
      target="_blank"
      rel="noopener noreferrer"
      title={`${site.title}\n${site.url}`}
      className={cn(
        "group flex w-full cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] px-2 py-[6px] text-left text-[13px] text-[var(--foreground-secondary)] transition-colors duration-100 hover:bg-[var(--muted)] hover:text-[var(--foreground)]",
        activeCategoryId && site.id === activeCategoryId && "bg-[var(--muted)]"
      )}
      style={{ paddingLeft: `${8 + depth * 24}px` }}
    >
      <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center text-[var(--neutral-400)] group-hover:text-[var(--neutral-600)]">
        <LinkIcon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1 truncate">{site.title}</span>
    </a>
  );
}

/* ============ 主组件 ============ */

export function Sidebar({
  categories,
  activeCategoryId,
  onCategoryChange,
  mobileOpen,
  onMobileClose,
  mobileAlwaysOpen,
}: SidebarProps) {
  // 展开状态：默认全部收起（仅显示顶级分类名称，点击再展开）
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  // 计算当前激活节点的祖先链，确保可见
  const activeAncestors = useMemo(() => {
    const chain = new Set<string>();
    const find = (cats: Category[], target: string): boolean => {
      for (const c of cats) {
        if (c.id === target) {
          chain.add(c.id);
          return true;
        }
        if (c.children && find(c.children, target)) {
          chain.add(c.id);
          return true;
        }
      }
      return false;
    };
    if (activeCategoryId) find(categories, activeCategoryId);
    return chain;
  }, [categories, activeCategoryId]);

  // 激活节点变化时自动展开祖先链；首屏挂载时跳过，保持「默认收起」
  const prevActiveRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (prevActiveRef.current === undefined) {
      // 首屏：记录初始激活节点但不展开，保持树默认收起
      prevActiveRef.current = activeCategoryId;
      return;
    }
    if (prevActiveRef.current === activeCategoryId) return;
    prevActiveRef.current = activeCategoryId;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 展开祖先链是导航的语义化副作用（展开当前分类路径）
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const id of activeAncestors) next.add(id);
      return next;
    });
  }, [activeCategoryId, activeAncestors]);

  // ESC 关闭移动端抽屉
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onMobileClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen, onMobileClose]);

  if (categories.length === 0) return null;

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderNav = (showSites: boolean) => (
    <nav
      aria-label="分类导航"
      className="flex h-full min-h-0 flex-col gap-0.5 overflow-y-auto py-2"
    >
      {categories.map((cat, idx) => (
        <CategoryRow
          key={cat.id}
          node={cat}
          depth={0}
          activeCategoryId={activeCategoryId}
          expanded={expanded}
          onToggle={toggle}
          onSelect={onCategoryChange}
          showSites={showSites}
          topIndex={idx}
        />
      ))}
    </nav>
  );

  return (
    <>
      {/* 桌面端：sticky 左列 —— 不展示站点链接（右侧主区已展示） */}
      <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-96 flex-shrink-0 border-r border-[var(--border)] bg-[var(--background-secondary)] md:block">
        <div className="relative flex h-full flex-col">
          <div className="flex items-center justify-between px-4 py-3">
            <h2 className="text-[13px] font-semibold text-[var(--foreground)]">全部分类</h2>
            <span className="text-xs tabular-nums text-[var(--muted-foreground)]">
              {categories.length}
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden px-2">{renderNav(false)}</div>
        </div>
      </aside>

      {/* 移动端：全屏 tree 模式（mobileAlwaysOpen，首屏直接展示不需打开抽屉，2026-08-22 用户拍板） */}
      {mobileAlwaysOpen && (
        <aside className="fixed inset-x-0 top-16 bottom-0 z-40 md:hidden border-t border-[var(--border)] bg-[var(--background-secondary)]">
          <div className="h-full overflow-hidden px-2 py-2">{renderNav(false)}</div>
        </aside>
      )}

      {/* 移动端：抽屉式 —— 展示站点链接（无右侧主区，链接需从树里直达） */}
      {!mobileAlwaysOpen && mobileOpen && (
        <div className="fixed inset-0 z-[60] md:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={onMobileClose}
            aria-label="关闭分类导航"
          />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-[var(--border)] bg-[var(--background-secondary)] shadow-xl">
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between px-4 py-3">
                <h2 className="text-sm font-semibold">全部分类</h2>
                <button
                  type="button"
                  onClick={onMobileClose}
                  className="rounded-[var(--radius-sm)] p-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                  aria-label="关闭"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M6 6L18 18M18 6L6 18"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden px-2">{renderNav(true)}</div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
