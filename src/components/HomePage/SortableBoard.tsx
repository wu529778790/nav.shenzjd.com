"use client";

/**
 * 可拖拽内容板（懒加载）
 *
 * 把 dnd-kit 的 DndContext / SortableContext / useDragAndDrop 整体隔离进本文件，
 * 由 HomeClient 通过 React.lazy 加载，从而把 @dnd-kit 相关代码（约 105KB）移出
 * 首页首屏关键 JS，等用户真正进入拖拽交互前才按需下载。
 *
 * 加载完成前，HomeClient 用 <StaticBoard /> 作 Suspense 回退，页面立即显示真实内容。
 */

import {
  DndContext,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { SortableCategoryItem } from "@/components/SortableCategoryItem";
import { useDragAndDrop } from "@/components/HomePage/useDragAndDrop";
import type { Category } from "@/lib/storage/local-storage";

interface SortableBoardProps {
  /** 全量分类（拖拽重排基于全量顺序） */
  categories: Category[];
  /** 搜索过滤后的分类（用于渲染与 SortableContext 的 items） */
  filteredCategories: Category[];
  viewMode: "grid" | "list";
  isGuestMode: boolean;
  onUpdateSites: (sites: Category[]) => void;
}

export function SortableBoard({
  categories,
  filteredCategories,
  viewMode,
  isGuestMode,
  onUpdateSites,
}: SortableBoardProps) {
  const { sensors, handleDragEnd, allSiteIds } = useDragAndDrop({
    categories,
    filteredCategories,
    onUpdateSites,
  });

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={[...filteredCategories.map((c) => c.id), ...allSiteIds]}
        strategy={
          viewMode === "grid"
            ? rectSortingStrategy
            : verticalListSortingStrategy
        }
      >
        <div className="space-y-4">
          {filteredCategories.map((category) => (
            <SortableCategoryItem
              key={category.id}
              category={category}
              onEdit={(cat) =>
                window.dispatchEvent(
                  new CustomEvent("edit-category", { detail: cat })
                )
              }
              onDelete={() =>
                window.dispatchEvent(
                  new CustomEvent("delete-category", {
                    detail: category.id,
                  })
                )
              }
              isGuestMode={isGuestMode}
              viewMode={viewMode}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
