/**
 * 空状态组件（纯只读展示）
 * 显示无数据或无搜索结果时的友好提示
 */

"use client";

import { IconSearch, IconBook } from "@/components/icons";

interface EmptyStateProps {
  searchQuery: string;
  onClearSearch: () => void;
}

export function EmptyState({ searchQuery, onClearSearch }: EmptyStateProps) {
  // 搜索结果为空
  if (searchQuery) {
    return (
      <div className="empty-state card p-12">
        <div className="empty-state-icon">
          <IconSearch className="h-8 w-8 text-[var(--muted-foreground)]" />
        </div>
        <div className="empty-state-title">未找到匹配内容</div>
        <div className="empty-state-description">尝试调整搜索词</div>
        <button
          onClick={onClearSearch}
          className="mt-4 cursor-pointer rounded-[var(--radius-md)] border border-[var(--border)] px-4 py-2 text-sm text-[var(--foreground-secondary)] transition-colors hover:bg-[var(--muted)]"
        >
          清除搜索
        </button>
      </div>
    );
  }

  // 无数据状态
  return (
    <div className="empty-state card p-12">
      <div className="empty-state-icon">
        <IconBook className="h-8 w-8 text-[var(--muted-foreground)]" />
      </div>
      <div className="empty-state-title">暂无分类</div>
      <div className="empty-state-description">
        数据由 navdata 工具链维护，请运行数据导入脚本
      </div>
    </div>
  );
}
