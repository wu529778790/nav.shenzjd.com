/**
 * 性能优化方案2：Context Selector + 乐观更新
 *
 * 目标：
 * 1. 解决 DataContext 全局重渲染问题
 * 2. 实现乐观更新（操作即时反馈）
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
import { getDataFromGitHub, getYourDataFromGitHub } from "@/lib/storage/github-storage";
import { scheduleSync } from "@/lib/storage/nav-sync";
import type { Category, Site, NavData } from "@/types";
import { useToast } from "@/components/ui/toast";

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
  isGuestMode,
  initialSites = [],
}: {
  children: ReactNode;
  isAuthenticated: boolean;
  isGuestMode: boolean;
  /** SSR 注入的种子数据；作为初始值避免首屏内容跳变（1条种子→N条本地数据） */
  initialSites?: Category[];
}) {
  // 首屏只读一次 localStorage，同步初始化 sites + loading —— 避免重复 I/O，
  // 同时保持"有本地缓存即秒开、无本地缓存才 loading"的语义。
  const [sites, setSites] = useState<Category[]>(() => {
    const localData = loadFromLocalStorage();
    if (isLocalDataValid(localData)) {
      return localData!.categories;
    }
    // 无效或空 → 回退到 SSR 种子（首次访客：首屏有内容可看）
    if (initialSites.length > 0) return initialSites;
    return [];
  });
  // 只在上方同步分支判定为"无有效初始数据"时才 loading，首屏不闪 skeleton
  const [loading, setLoading] = useState(() => {
    const localData = loadFromLocalStorage();
    return !isLocalDataValid(localData) && initialSites.length === 0;
  });
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();
  // 防抖标记：一次登录会话内不重复触发自动 fork
  const autoForkTriggeredRef = useRef(false);

  // 用于竞态控制：只允许最新的 fetch 更新状态
  const fetchIdRef = useRef(0);
  // 用于检测认证状态从未登录→已登录的变化，确保切换后强制拉取用户数据
  const prevAuthRef = useRef(isAuthenticated);
  // 用 ref 追踪当前 sites，避免 fetchSites 依赖 sites.length 导致无限刷新
  const sitesRef = useRef<Category[]>([]);

  /**
   * 初始化：Stale-While-Revalidate
   *
   * 1. 本地有效 → 立即秒开（loading=false）
   * 2. 后台异步 revalidate（满足任一条件触发）：
   *    - 本地无有效数据
   *    - 认证状态从未登录→已登录（首次登录后拉取用户数据）
   *    - 已登录 + forceRefresh
   * 3. revalidate 时：
   *    - 已登录 → 拉自己的 GitHub 数据（通过 /api/github/data 带 Cookie）
   *    - 访客 → 拉示例数据（每次拉，保证新鲜）
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
        // 认证状态从未登录→已登录时，必须重新拉取用户数据（覆盖首次加载本地无缓存的场景）
        const authJustCompleted = isAuthenticated && !prevAuthRef.current;
        if (authJustCompleted) prevAuthRef.current = true;
        const shouldRevalidate = !localValid || authJustCompleted || (isAuthenticated && _forceRefresh);

        if (shouldRevalidate) {
          // 本地无效且没有首屏数据时，才显示 loading
          // 有首屏数据（SSR seed 或同步 localStorage）时静默更新，不闪现 skeleton
          const hasInitialData = sitesRef.current.length > 0;
          if (!localValid && !hasInitialData) setLoading(true);

          let remoteData: NavData | null = null;

          if (isAuthenticated) {
            try {
              remoteData = await getDataFromGitHub("token-from-context");
            } catch (e) {
              const err = e as Error & { name?: string; status?: number };
              const isForkNotCreated =
                err?.name === "ForkNotCreatedError" ||
                err?.message === "fork-not-created";

              if (isForkNotCreated) {
                // fork 仓库不存在 → 自动触发 fork 创建链：
                // 后端 POST /api/github/data 会在写入 data/sites.json 之前
                // 先执行 ensureForkedFromCookie → createFork → pollForkReady
                //（poll 最多 8 次 × 1s × 2.0 退避 ≈ 50s 总等待）
                // 成功后前端自动第二次 fetchSites 拿到数据。
                if (!autoForkTriggeredRef.current) {
                  autoForkTriggeredRef.current = true;
                  const local = loadFromLocalStorage();
                  if (local) {
                    console.info(
                      "[DataContext] fork 不存在，自动触发首次写操作（immediate）",
                    );
                    showToast("正在为您初始化 GitHub 仓库，请稍候...", "info", 8000);
                    scheduleSync(local, true);
                  }
                } else {
                  // 自动触发已经执行过一次仍失败 → 提示稍后重试
                  console.warn("[DataContext] 自动 fork 已执行但仍 fork-not-created，跳过重复触发");
                  showToast("仓库初始化失败，请稍后重试", "warning");
                }
              } else {
                console.error("读取 GitHub 数据失败:", e);
              }
            }
          } else if (!isAuthenticated || isGuestMode) {
            remoteData = await getYourDataFromGitHub();
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
    [isAuthenticated, isGuestMode, showToast]
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

  // 监听认证变化自动刷新
  useEffect(() => {
    const handleAuthUpdate = () => fetchSites(true);
    window.addEventListener("auth-update", handleAuthUpdate);
    return () => window.removeEventListener("auth-update", handleAuthUpdate);
  }, [fetchSites]);

  /**
   * ✨ 优化1：使用函数式更新 + 稳定引用的回调
   */
  const addSite = useCallback(
    async (categoryId: string, site: Site) => {
      if (isGuestMode) {
        window.location.href = "/api/auth/github/login";
        return;
      }

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

      // 防抖 3s 后自动 sync 到 GitHub（之前这里是空函数导致 fork 从未被创建）
      const data = loadFromLocalStorage();
      if (data) scheduleSync(data, false);
    },
    [isGuestMode]
  );

  const updateSite = useCallback(
    async (categoryId: string, siteId: string, site: Site) => {
      if (isGuestMode) {
        window.location.href = "/api/auth/github/login";
        return;
      }

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

      // 立即同步（之前这里是空函数导致 fork 从未被创建）
      const data = loadFromLocalStorage();
      if (data) scheduleSync(data, true);
    },
    [isGuestMode]
  );

  const deleteSite = useCallback(
    async (categoryId: string, siteId: string) => {
      if (isGuestMode) {
        window.location.href = "/api/auth/github/login";
        return;
      }

      // 乐观更新：立即从UI移除
      setSites((prevSites) => {
        const newSites = prevSites.map((category) =>
          category.id === categoryId
            ? { ...category, sites: category.sites.filter((s) => s.id !== siteId) }
            : category
        );
        saveSitesToLocalStorage(newSites);
        return newSites;
      });

      // 立即同步（之前这里是空函数导致 fork 从未被创建）
      const data = loadFromLocalStorage();
      if (data) scheduleSync(data, true);
    },
    [isGuestMode]
  );

  const addCategory = useCallback(
    async (category: Category) => {
      if (isGuestMode) {
        window.location.href = "/api/auth/github/login";
        return;
      }

      // 乐观更新
      setSites((prevSites) => {
        const newSites = [...prevSites, category];
        saveSitesToLocalStorage(newSites);
        return newSites;
      });

      // 防抖 3s 后自动 sync 到 GitHub（之前这里是空函数导致 fork 从未被创建）
      const data = loadFromLocalStorage();
      if (data) scheduleSync(data, false);
    },
    [isGuestMode]
  );

  const updateCategory = useCallback(
    async (categoryId: string, category: Category) => {
      if (isGuestMode) {
        window.location.href = "/api/auth/github/login";
        return;
      }

      // 乐观更新
      setSites((prevSites) => {
        const newSites = prevSites.map((c) =>
          c.id === categoryId ? category : c
        );
        saveSitesToLocalStorage(newSites);
        return newSites;
      });

      // 立即同步（之前这里是空函数导致 fork 从未被创建）
      const data = loadFromLocalStorage();
      if (data) scheduleSync(data, true);
    },
    [isGuestMode]
  );

  const deleteCategory = useCallback(
    async (categoryId: string) => {
      if (isGuestMode) {
        window.location.href = "/api/auth/github/login";
        return;
      }

      // 乐观更新
      setSites((prevSites) => {
        const newSites = prevSites.filter((c) => c.id !== categoryId);
        saveSitesToLocalStorage(newSites);
        return newSites;
      });

      // 立即同步（之前这里是空函数导致 fork 从未被创建）
      const data = loadFromLocalStorage();
      if (data) scheduleSync(data, true);
    },
    [isGuestMode]
  );

  const updateSites = useCallback(
    async (newSites: Category[]) => {
      if (isGuestMode) {
        window.location.href = "/api/auth/github/login";
        return;
      }

      setSites(newSites);
      saveSitesToLocalStorage(newSites);
      // 立即同步（之前这里是空函数导致 fork 从未被创建）
      const data = loadFromLocalStorage();
      if (data) scheduleSync(data, true);
    },
    [isGuestMode]
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
 *
 * @example
 * // ❌ 旧方式：loading 变化也会触发重渲染
 * const { sites, loading } = useData();
 *
 * // ✅ 新方式：只在 sites 变化时更新
 * const sites = useSitesData();
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
 * ✨ 数据变化时不会触发重渲染（函数引用稳定）
 *
 * 适用场景：SiteCard、AddSiteDialog 等只需要操作方法的组件
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
