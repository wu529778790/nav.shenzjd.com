/**
 * 分类导航 tab 栏(桌面+移动端统一,WeTab 风格)
 * - 横向滚动 chip,当前分类高亮
 * - 点击平滑跳转
 */

"use client";

import { cn } from "@/lib/utils";
import { useActiveCategory } from "@/hooks/use-active-category";
import type { Category } from "@/lib/storage/local-storage";
import { visibleCategories } from "@/lib/utils/tombstone";

interface CategoryTabBarProps {
  categories: Category[];
}

export function CategoryTabBar({ categories }: CategoryTabBarProps) {
  const visible = visibleCategories(categories);
  const activeId = useActiveCategory(visible);

  if (visible.length === 0) return null;

  const handleClick = (categoryId: string) => {
    const el = document.getElementById(`category-${categoryId}`);
    if (el) {
      // sticky 顶栏高度约 44px (top-16 = 64px + 顶栏内容 ~44px)
      const stickyOffset = 52;
      const y = el.getBoundingClientRect().top + window.scrollY - stickyOffset;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  return (
    <nav aria-label="分类导航" className="min-w-0">
      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {visible.map((cat) => {
          const isActive = activeId === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => handleClick(cat.id)}
              className={cn(
                "flex flex-shrink-0 cursor-pointer items-center gap-1 px-2.5 py-1.5 text-sm transition-colors rounded-[var(--radius-md)]",
                isActive
                  ? "bg-[var(--primary-600)] text-white font-medium"
                  : "text-[var(--foreground-secondary)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
              )}
            >
              <span>{cat.name}</span>
              <span className={cn("text-xs tabular-nums", isActive ? "text-white/70" : "text-[var(--muted-foreground)]")}>
                {cat.sites.length}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
