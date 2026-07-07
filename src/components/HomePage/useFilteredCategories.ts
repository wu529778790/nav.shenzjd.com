/**
 * 搜索过滤逻辑 Hook
 * 将过滤逻辑从主页组件中抽离
 */

"use client";

import { useState, useEffect, useMemo } from "react";
import type { Category } from "@/lib/storage/local-storage";
import { visibleCategories } from "@/lib/utils/tombstone";

interface UseFilteredCategoriesResult {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filteredCategories: Category[];
  searchResultsCount: number;
}

export function useFilteredCategories(
  categories: Category[]
): UseFilteredCategoriesResult {
  const [searchQuery, setSearchQuery] = useState("");

  // 监听来自 AppHeader 的全局搜索事件
  useEffect(() => {
    const handleGlobalSearch = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      setSearchQuery(detail);
    };

    window.addEventListener("global-search", handleGlobalSearch);
    return () => window.removeEventListener("global-search", handleGlobalSearch);
  }, []);

  // 过滤逻辑
  const filteredCategories = useMemo(() => {
    let result = categories;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      const filtered: Category[] = [];

      for (const category of result) {
        const categoryMatches = category.name.toLowerCase().includes(query);

        const matchingSites = category.sites.filter(
          (site) =>
            site.title.toLowerCase().includes(query) ||
            site.url.toLowerCase().includes(query)
        );

        if (categoryMatches || matchingSites.length > 0) {
          filtered.push({
            ...category,
            sites:
              matchingSites.length > 0 ? matchingSites : category.sites,
          });
        }
      }

      result = filtered;
    }

    // 过滤墓碑条目：删除的站点 / 分类不在界面出现，但删除事实仍保留在数据里供同步
    return visibleCategories(result);
  }, [categories, searchQuery]);

  // 计算搜索结果数量
  const searchResultsCount = useMemo(() => {
    return filteredCategories.reduce(
      (sum, cat) => sum + cat.sites.length,
      0
    );
  }, [filteredCategories]);

  return {
    searchQuery,
    setSearchQuery,
    filteredCategories,
    searchResultsCount,
  };
}
