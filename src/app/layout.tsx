import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { SitesProvider } from "@/contexts/SitesContext";
import { ToastProvider } from "@/components/ui/toast";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { UpdateBanner } from "@/components/UpdateBanner";
import { readNavData } from "@/lib/server/turso";
import { visibleCategories } from "@/lib/utils/tombstone";
import type { Category } from "@/types";

// Plus Jakarta Sans（可变字体，自托管于 src/fonts，避免构建期依赖 Google Fonts）
// display=optional 避免阻塞首屏渲染；preload 让字体随首屏关键资源一起加载。
export const plusJakarta = localFont({
  src: "../fonts/plus-jakarta-sans-latin-wght-normal.woff2",
  variable: "--font-plus-jakarta",
  display: "optional",
  preload: true,
});

export const metadata: Metadata = {
  title: {
    default: "NavHub - 个人导航网站",
    template: "%s | NavHub",
  },
  description:
    "NavHub 是一个现代化的个人导航书签管理工具，支持本地存储和 GitHub 同步，让你随时随地访问常用网站。",
  keywords: ["导航", "书签", "收藏夹", "个人导航", "NavHub", "bookmark", "navigation"],
  authors: [{ name: "NavHub" }],
  creator: "NavHub",
  metadataBase: new URL("https://navhub.shenzjd.com"),
  openGraph: {
    type: "website",
    locale: "zh_CN",
    url: "https://navhub.shenzjd.com",
    siteName: "NavHub",
    title: "NavHub - 个人导航网站",
    description:
      "现代化的个人导航书签管理工具，支持本地存储和 GitHub 同步。",
  },
  twitter: {
    card: "summary_large_image",
    title: "NavHub - 个人导航网站",
    description: "现代化的个人导航书签管理工具，支持本地存储和 GitHub 同步。",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#167f73",
  width: "device-width",
  initialScale: 1,
};

/**
 * 根布局
 *
 * 全站私有模式（2026-08-21 起）：服务端直读 Turso 数据库，把真实书签 SSR 进首屏
 * （这才是「秒开」的真正杠杆——不再有骨架屏等待，首屏 HTML 即含完整书签网格）。
 * DataContext 初始化优先用 SSR 注入的 initialSites，保证 SSR/CSR 一致无闪跳。
 */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 服务端直读数据库（失败时降级为空，不阻塞页面）
  let initialSites: Category[] = [];
  try {
    const data = await readNavData();
    if (data) {
      initialSites = visibleCategories(data.categories);
    }
  } catch (error) {
    console.error("SSR 读取数据库失败，降级为空数据:", error);
  }

  return (
    <html lang="zh-CN" className={plusJakarta.variable}>
      <body className="antialiased">
        <ErrorBoundary>
          <ToastProvider>
            <AuthProvider>
            <SitesProvider initialSites={initialSites}>
              <ServiceWorkerRegister />
              <UpdateBanner />
              {children}
            </SitesProvider>
          </AuthProvider>
          </ToastProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
