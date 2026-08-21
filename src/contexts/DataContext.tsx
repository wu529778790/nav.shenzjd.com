/**
 * 性能优化方案2：Context Selector + 乐观更新
 *
 * 目标：
 * 1. 解决 DataContext 全局重渲染问题
 * 2. 实现乐观更新（操作即时反馈）
 *
 * 全站私有模式（2026-08-21 起）：无访客/登录概念，数据统一存 Turso 数据库。
 */

"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  ReactNode,
} from "react";
import {
  loadFromLocalStorage,
  saveSitesToLocalStorage,
  getSitesFromLocalStorage,
  isLocalDataValid,
} from "@/lib/storage/local-storage";
import { getDataFromDb } from "@/lib/storage/db-storage";
import { scheduleSync } from "@/lib/storage/nav-sync";
import type { Category, Site, NavData } from "@/types";

interface DataContextType {
  sites: Category[];
  loading: boolean;
  error: string | null;
  clearError: () => void;
  addSite: (categoryId: string, site: Site) => Promise<void>;
  updateSite: (categoryId: string, siteId: string, site: Site) => Promise<void>;
  deleteSite: (categoryId: string, siteId: string) => Promise<void>;
  addCategory: (category: Category) => Promise<void>;
  updateCategory: (categoryId: string, category: Category) => Promise<void>;
  deleteCategory: (categoryId: string) => Promise<void>;
  refreshSites: (forceRefresh?: boolean) => Promise<void>;
  updateSites: (sites: Category[]) => Promise<void>;
}

const DataContext = createContext<DataContextType | null>(null);

const defaultCategory: Category = {
  id: "default",
  name: "默认分类",
  sort: 0,
  sites: [],
};

export function DataProvider({
  children,
  isAuthenticated,
  initialSites = [],
}: {
  children: ReactNode;
  isAuthenticated: boolean;
  /** SSR 注入的种子数据；作为初始值避免首屏内容跳变（1条种子→N条本地数据） */
  initialSites?: Category[];
}) {
  // 首屏初始化：SSR 注入的 initialSites 优先（服务端直读数据库的真实数据，
  // 保证 SSR HTML 与客户端首帧一致，无闪跳）；无 SSR 数据时才用 localStorage 兜底。
  const [sites, setSites] = useState<Category[]>(() => {
    if (initialSites.length > 0) {
      return initialSites;
    }
    const localData = loadFromLocalStorage();
    if (isLocalDataValid(localData)) {
      return localData!.categories;
    }
    return [];
  });
  // SSR 已有数据 → 不闪骨架屏；无任何初始数据才 loading
  const [loading, setLoading] = useState(() => {
    if (initialSites.length > 0) return false;
    const localData = loadFromLocalStorage();
    return !isLocalDataValid(localData);
  });
  const [error, setError] = useState<string | null>(null);

  // 用于竞态控制：只允许最新的 fetch 更新状态
  const fetchIdRef = useRef(0);
  // 用 ref 追踪当前 sites，避免 fetchSites 依赖 sites.length 导致无限刷新
  const sitesRef = useRef<Category[]>([]);

  /**
   * 初始化：Stale-While-Revalidate
   *
   * 1. 本地有效 → 立即秒开（loading=false）
   * 2. 后台异步 revalidate（满足任一条件触发）：
   *    - 本地无有效数据
   *    - forceRefresh
   * 3. revalidate 时：从数据库拉取（通过 /api/data）
   * 4. 远程有内容 → 静默替换；远程失败 → 保持本地不动
   * 5. 本地也无效 → 仅内存设默认分类（不持久化，避免卡死）
   */
  const fetchSites = useCallback(
    async (_forceRefresh = false) => {
      const currentFetchId = ++fetchIdRef.current;
      try {
        setError(null);

        // 第一步：本地秒开（Stale）
        const localData = loadFromLocalStorage();
        const localValid = isLocalDataValid(localData);
        if (localValid) {
          setSites(localData!.categories);
          setLoading(false);
        }

        // 第二步：后台 Revalidate（决定要不要拉远程）
        const shouldRevalidate = !localValid || (isAuthenticated && _forceRefresh);

        if (shouldRevalidate) {
          // 本地无效且没有首屏数据时，才显示 loading
          // 有首屏数据（SSR seed 或同步 localStorage）时静默更新，不闪现 skeleton
          const hasInitialData = sitesRef.current.length > 0;
          if (!localValid && !hasInitialData) setLoading(true);

          let remoteData: NavData | null = null;

          try {
            remoteData = await getDataFromDb();
          } catch (e) {
            console.error("读取数据库数据失败:", e);
          }

          if (currentFetchId !== fetchIdRef.current) return;

          // 远程有有效内容 → 静默替换本地（SWR 核心）
          if (remoteData?.categories && remoteData.categories.length > 0) {
            saveSitesToLocalStorage(remoteData.categories);
            setSites(remoteData.categories);
            setLoading(false);
            return;
          }

          // 远程为空/失败：本地有效则保持本地，否则只设内存默认分类（不持久化）
          if (currentFetchId !== fetchIdRef.current) return;
          setSites((prev) => {
            if (prev.length === 0) {
              return [defaultCategory];
            }
            return prev;
          });
          setLoading(false);
          return;
        }

        // 本地有效且无需 revalidate：loading 已在第一步关闭
      } catch (err) {
        if (currentFetchId !== fetchIdRef.current) return;
        setError(err instanceof Error ? err.message : "加载失败");
        const fallbackLocal = getSitesFromLocalStorage();
        if (fallbackLocal.length > 0) {
          setSites(fallbackLocal);
        } else {
          setSites([defaultCategory]);
          saveSitesToLocalStorage([defaultCategory]);
        }
        setLoading(false);
      }
    },
    [isAuthenticated]
  );

  // 同步 sites → ref，供 fetchSites 内读取而不放入依赖
  useEffect(() => {
    sitesRef.current = sites;
  }, [sites]);

  // 组件挂载时加载数据
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 组件挂载时必须从外部源获取初始数据
    fetchSites();
  }, [fetchSites]);

  /**
   * ✨ 优化1：使用函数式更新 + 稳定引用的回调
   */
  const addSite = useCallback(
    async (categoryId: string, site: Site) => {
      // 乐观更新：立即更新UI
      setSites((prevSites) => {
        const newSites = prevSites.map((category) =>
          category.id === categoryId
            ? { ...category, sites: [...category.sites, site] }
            : category
        );
        saveSitesToLocalStorage(newSites);
        return newSites;
      });

      // 防抖 3s 后自动 sync 到数据库
      const data = loadFromLocalStorage();
      if (data) scheduleSync(data, false);
    },
    []
  );

  const updateSite = useCallback(
    async (categoryId: string, siteId: string, site: Site) => {
      // 乐观更新：立即更新UI
      setSites((prevSites) => {
        const newSites = prevSites.map((category) =>
          category.id === categoryId
            ? {
                ...category,
                sites: category.sites.map((s) => (s.id === siteId ? site : s)),
              }
            : category
        );
        saveSitesToLocalStorage(newSites);
        return newSites;
      });

      // 立即同步
      const data = loadFromLocalStorage();
      if (data) scheduleSync(data, true);
    },
    []
  );

  const deleteSite = useCallback(
    async (categoryId: string, siteId: string) => {
      // 乐观更新：打墓碑标记（不真删），让删除能跨设备传播
      setSites((prevSites) => {
        const newSites = prevSites.map((category) =>
          category.id === categoryId
            ? {
                ...category,
                sites: category.sites.map((s) =>
                  s.id === siteId
                    ? { ...s, _deleted: true, deletedAt: new Date().toISOString() }
                    : s
                ),
              }
            : category
        );
        saveSitesToLocalStorage(newSites);
        return newSites;
      });

      // 立即同步
      const data = loadFromLocalStorage();
      if (data) scheduleSync(data, true);
    },
    []
  );

  const addCategory = useCallback(
    async (category: Category) => {
      // 乐观更新
      setSites((prevSites) => {
        const newSites = [...prevSites, category];
        saveSitesToLocalStorage(newSites);
        return newSites;
      });

      // 防抖 3s 后自动 sync 到数据库
      const data = loadFromLocalStorage();
      if (data) scheduleSync(data, false);
    },
    []
  );

  const updateCategory = useCallback(
    async (categoryId: string, category: Category) => {
      // 乐观更新
      setSites((prevSites) => {
        const newSites = prevSites.map((c) =>
          c.id === categoryId ? category : c
        );
        saveSitesToLocalStorage(newSites);
        return newSites;
      });

      // 立即同步
      const data = loadFromLocalStorage();
      if (data) scheduleSync(data, true);
    },
    []
  );

  const deleteCategory = useCallback(
    async (categoryId: string) => {
      // 乐观更新：打墓碑标记（不真删），让分类删除也能跨设备传播
      setSites((prevSites) => {
        const newSites = prevSites.map((c) =>
          c.id === categoryId
            ? { ...c, _deleted: true, deletedAt: new Date().toISOString() }
            : c
        );
        saveSitesToLocalStorage(newSites);
        return newSites;
      });

      // 立即同步
      const data = loadFromLocalStorage();
      if (data) scheduleSync(data, true);
    },
    []
  );

  const updateSites = useCallback(
    async (newSites: Category[]) => {
      setSites(newSites);
      saveSitesToLocalStorage(newSites);
      // 立即同步
      const data = loadFromLocalStorage();
      if (data) scheduleSync(data, true);
    },
    []
  );

  const clearError = useCallback(() => setError(null), []);

  /**
   * ✨ 优化2：使用 useMemo 确保稳定的 contextValue
   * 只有依赖项变化时才创建新对象
   */
  const contextValue = useMemo<DataContextType>(
    () => ({
      sites,
      loading,
      error,
      clearError,
      addSite,
      updateSite,
      deleteSite,
      addCategory,
      updateCategory,
      deleteCategory,
      refreshSites: fetchSites,
      updateSites,
    }),
    [
      sites,
      loading,
      error,
      clearError,
      addSite,
      updateSite,
      deleteSite,
      addCategory,
      updateCategory,
      deleteCategory,
      fetchSites,
      updateSites,
    ]
  );

  return (
    <DataContext.Provider value={contextValue}>{children}</DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
}

// ========== ✨ 性能优化：精准订阅 Hooks ==========

/**
 * 只订阅站点数据
 * ✨ 只有 sites 变化时才重渲染，loading/error 变化不会触发更新
 */
export function useSitesData(): Category[] {
  const { sites } = useData();
  return sites;
}

/**
 * 只订阅加载状态
 * ✨ 只有 loading 变化时才重渲染
 */
export function useLoadingState(): boolean {
  const { loading } = useData();
  return loading;
}

/**
 * 只订阅错误信息 + 清除方法
 */
export function useErrorState(): { error: string | null; clearError: () => void } {
  const { error, clearError } = useData();
  return { error, clearError };
}

/**
 * 只订阅站点操作方法（不包含数据）
 */
export function useSiteOperations() {
  const { addSite, updateSite, deleteSite } = useData();
  return { addSite, updateSite, deleteSite };
}

/**
 * 只订阅分类操作方法
 */
export function useCategoryOperations() {
  const { addCategory, updateCategory, deleteCategory } = useData();
  return { addCategory, updateCategory, deleteCategory };
}

/**
 * 订阅数据 + 更新方法
 */
export function useSitesWithUpdate() {
  const { sites, updateSites } = useData();
  return { sites, updateSites };
}

/**
 * 订阅数据 + 清除错误方法
 */
export function useSitesWithClearError() {
  const { sites, error, clearError } = useData();
  return { sites, error, clearError };
}
