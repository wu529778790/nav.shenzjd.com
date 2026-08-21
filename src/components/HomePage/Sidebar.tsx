/**
 * 左侧树形分类导航 Sidebar（2026-08-21 树状重构）
 *
 * 递归渲染任意深度的分类树（axutongxue 数据最深 5 层）。
 * - 有 children 的节点：点击 chevron 展开/折叠，点击名称选中
 * - 叶子节点：点击选中
 * - 桌面端 sticky 左列，移动端抽屉
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, ChevronLeft, FolderOpen, Folder } from "lucide-react";
import type { Category } from "@/types";

interface SidebarProps {
  categories: Category[];
  activeCategoryId: string | null;
  onCategoryChange: (categoryId: string) => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

/** 递归树节点 */
function TreeNode({
  node,
  depth,
  activeCategoryId,
  expanded,
  onToggle,
  onSelect,
  collapsed,
}: {
  node: Category;
  depth: number;
  activeCategoryId: string | null;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  collapsed: boolean;
}) {
  const hasChildren = (node.children?.length ?? 0) > 0;
  const isActive = node.id === activeCategoryId;
  const isExpanded = expanded.has(node.id);

  return (
    <div>
      <button
        type="button"
        onClick={() => onSelect(node.id)}
        className={cn(
          "group flex w-full cursor-pointer items-center gap-1.5 rounded-[var(--radius-md)] px-2 py-1.5 text-left text-sm transition-colors",
          isActive
            ? "bg-[var(--primary-600)]/10 font-medium text-[var(--primary-700)]"
            : "text-[var(--foreground-secondary)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]",
          collapsed && "justify-center px-1.5",
          depth > 0 && "pl-3.5"
        )}
        style={collapsed ? undefined : { paddingLeft: `${depth * 14 + 8}px` }}
        title={node.name}
      >
        {/* 展开指示器 */}
        {hasChildren ? (
          <span
            role="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.id);
            }}
            className={cn(
              "flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-sm text-[var(--muted-foreground)] hover:bg-[var(--muted)]",
              collapsed && "hidden"
            )}
            aria-label={isExpanded ? "折叠" : "展开"}
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </span>
        ) : (
          <span className="w-4 flex-shrink-0" />
        )}

        {/* 图标 */}
        {!collapsed && (
          <span className="flex-shrink-0 text-sm leading-none">
            {node.icon || (hasChildren ? <Folder className="h-3.5 w-3.5 text-[var(--muted-foreground)]" /> : <FolderOpen className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />)}
          </span>
        )}

        {!collapsed && (
          <>
            <span className="min-w-0 flex-1 truncate">{node.name}</span>
            <span
              className={cn(
                "flex-shrink-0 text-[11px] tabular-nums",
                isActive ? "text-[var(--primary-600)]" : "text-[var(--muted-foreground)]"
              )}
            >
              {node.sites.length > 0 ? node.sites.length : ""}
            </span>
          </>
        )}
      </button>

      {/* 子节点（展开时递归渲染） */}
      {hasChildren && isExpanded && !collapsed && (
        <div className="mt-0.5 space-y-0.5">
          {node.children!.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              activeCategoryId={activeCategoryId}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
              collapsed={collapsed}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar({
  categories,
  activeCategoryId,
  onCategoryChange,
  mobileOpen,
  onMobileClose,
}: SidebarProps) {
  // 桌面端折叠态（窄屏隐藏为图标列）
  const [collapsed, setCollapsed] = useState(false);

  // 展开状态：默认展开顶级一层 + 当前激活节点的祖先链
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    return new Set(categories.map((c) => c.id));
  });

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

  // 激活节点变化时自动展开祖先链
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 展开祖先链是导航的语义化副作用（展开当前分类路径）
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const id of activeAncestors) next.add(id);
      return next;
    });
  }, [activeAncestors]);

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

  const nav = (
    <nav
      aria-label="分类导航"
      className="flex h-full min-h-0 flex-col gap-0.5 overflow-y-auto py-3"
    >
      {categories.map((cat) => (
        <TreeNode
          key={cat.id}
          node={cat}
          depth={0}
          activeCategoryId={activeCategoryId}
          expanded={expanded}
          onToggle={toggle}
          onSelect={onCategoryChange}
          collapsed={collapsed}
        />
      ))}
    </nav>
  );

  // 桌面端：sticky 左列
  return (
    <>
      <aside
        className={cn(
          "sticky top-16 hidden h-[calc(100vh-4rem)] flex-shrink-0 border-r border-[var(--border)] bg-[var(--background)] transition-all duration-200 md:block",
          collapsed ? "w-12" : "w-64"
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
        <div className="fixed inset-0 z-[60] md:hidden" role="dialog" aria-modal="true">
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