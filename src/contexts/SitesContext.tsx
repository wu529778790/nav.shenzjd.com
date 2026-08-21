/**
 * Sites Context (组合层)
 * 组合 AuthContext + DataContext + SyncProvider
 * 保持向后兼容：useSites() 仍然可用
 *
 * 新代码建议直接使用:
 * - useAuth()   → 认证状态（isGuestMode, authUser）
 * - useData()   → 数据 CRUD（sites, addSite, ...）
 */

"use client";

import { ReactNode } from "react";
import { AuthProvider, useAuth } from "./AuthContext";
import { DataProvider } from "./DataContext";
import type { Category } from "@/types";

/**
 * 站点级事件回调：SitesProvider 向外暴露几个站点层级的反馈钩子。
 * useSites() 的消费方可通过这些回调感知同步结果、token 丢失等。
 */
export interface SitesEventCallbacks {
  /** POST /api/data 成功 */
  onSyncSuccess?: () => void;
  /** POST /api/data 失败 */
  onSyncError?: (err: Error) => void;
  /** 用户切换检测到（A → B），让 DataProvider 重置内部 state */
  onUserLoginDetected?: () => void;
}

interface SitesProviderProps {
  children: ReactNode;
  /** SSR 注入的种子数据，透传至 DataProvider 避免首屏跳变 */
  initialSites?: Category[];
}

/**
 * SitesProvider - 组合 Auth + Data + Sync
 *
 * Sync 职责全部由 layout.tsx 处理：它读取 useAuth()，实例化 SyncManager，
 * 然后把桥接函数通过 props 透传：
 * - onSyncRequest 连接 SitesContext → DataContext，修复原有空函数 bug
 * - onUserChanged 处理用户切换时清空 localStorage 并重新拉取数据
 */
export function SitesProvider({ children, initialSites = [] }: SitesProviderProps) {
  return (
    <DataProvider isAuthenticated={true} initialSites={initialSites}>
      {children}
    </DataProvider>
  );
}

// 导出组合 Provider（包含 AuthProvider）
export function AppProviders({ children, initialSites = [] }: SitesProviderProps) {
  return (
    <AuthProvider>
      <SitesProvider initialSites={initialSites}>{children}</SitesProvider>
    </AuthProvider>
  );
}

// Re-export 子 hooks 以保持向后兼容
export { useAuth } from "./AuthContext";
export { useData } from "./DataContext";

// 内部导入（用于 createUseSites）
import { useData as _useData } from "./DataContext";

// 注意: 由于 React Hooks 不能条件调用，
// 实际使用时需要通过其他方式注入 syncState
// 这里保留接口定义供参考

/**
 * @deprecated 建议使用 useAuth() + useData() 替代
 * 如需完整功能，请使用 AppProviders 包裹并分别调用子 hooks
 */
export function useSites() {
  console.warn(
    "useSites() is deprecated. Please use useAuth() + useData() separately for better performance."
  );

  // 尝试获取上下文（可能不完整）
  const auth = useAuth();
  const data = _useData();

  return {
    ...data,
    isGuestMode: auth.isGuestMode,
    authUser: auth.authUser,
    // 同步相关字段需要在更上层提供
    syncStatus: "",
    syncStep: null,
    isOnline: true,
    lastSync: null,
  };
}
