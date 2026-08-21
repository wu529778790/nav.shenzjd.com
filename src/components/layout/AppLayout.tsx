/**
 * 应用布局组件（2026-08-21 树形导航站重构）
 * 页面无页脚，Header 由 HomeClient 持有搜索状态渲染。
 */

import { ReactNode } from "react";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-x-clip">
      {children}
    </div>
  );
}
