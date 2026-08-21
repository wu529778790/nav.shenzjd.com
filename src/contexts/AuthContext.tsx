/**
 * 认证状态 Context
 *
 * 全站私有模式（2026-08-21 起）：不再有 GitHub OAuth / 访客模式。
 * 站点仅自己使用，访问即读写，恒为已登录状态。
 * 保留接口结构（isAuthenticated / isGuestMode / authUser）以兼容消费方代码。
 */

"use client";

import { createContext, useContext, useMemo, ReactNode } from "react";
import type { AuthUser } from "@/types";

interface AuthContextType {
  /** 全站私有：恒为已登录 */
  isAuthenticated: boolean;
  /** 全站私有：恒非访客模式 */
  isGuestMode: boolean;
  /** 无用户概念，恒为 null */
  authUser: AuthUser | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const contextValue = useMemo<AuthContextType>(
    () => ({
      isAuthenticated: true,
      isGuestMode: false,
      authUser: null,
    }),
    []
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
