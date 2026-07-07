/**
 * 移动端分类导航(横向滚动 chip 栏)
 * - 仅在 <lg 显示,桌面端用浮动侧边栏
 * - 当前可见分类高亮,点击平滑跳转
 */

"use client";

import { cn } from "@/lib/utils";
import { useActiveCategory } from "@/hooks/use-active-category";
import type { Category } from "@/lib/storage/local-storage";
import { visibleCategories } from "@/lib/utils/tombstone";

interface MobileCategoryNavProps {
  categories: Category[];
}

export function MobileCategoryNav({ categories }: MobileCategoryNavProps) {
  const visible = visibleCategories(categories);
  const activeId = useActiveCategory(visible);

  if (visible.length === 0) return null;

  const handleClick = (categoryId: string) => {
    const el = document.getElementById(`category-${categoryId}`);
    if (el) {
      // sticky 顶栏高度约 44px
      const stickyOffset = 52;
      const y = el.getBoundingClientRect().top + window.scrollY - stickyOffset;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  return (
    <nav aria-label="分类导航" className="lg:hidden">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {visible.map((cat) => {
          const isActive = activeId === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => handleClick(cat.id)}
              className={cn(
                "flex flex-shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                isActive
                  ? "border-[var(--primary-500)] bg-[var(--primary-600)] text-white"
                  : "border-[var(--border)] bg-[var(--background-secondary)] text-[var(--foreground-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
              )}
            >
              <span>{cat.name}</span>
              <span
                className={cn(
                  "text-xs tabular-nums",
                  isActive ? "text-white/75" : "text-[var(--muted-foreground)]"
                )}
              >
                {cat.sites.length}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
