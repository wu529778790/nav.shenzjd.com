import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";

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
    "NavHub 是一个现代化的导航书签聚合站，聚合影视、阅读、工具、AI、资源搜索等 4000+ 优质链接，支持全文搜索与子主题筛选。",
  keywords: ["导航", "书签", "收藏夹", "资源", "NavHub", "bookmark", "navigation"],
  authors: [{ name: "NavHub" }],
  creator: "NavHub",
  metadataBase: new URL("https://navhub.shenzjd.com"),
  openGraph: {
    type: "website",
    locale: "zh_CN",
    url: "https://navhub.shenzjd.com",
    siteName: "NavHub",
    title: "NavHub - 个人导航网站",
    description: "聚合 4000+ 优质链接的导航站：影视、阅读、工具、AI、资源搜索。",
  },
  twitter: {
    card: "summary_large_image",
    title: "NavHub - 个人导航网站",
    description: "聚合 4000+ 优质链接的导航站：影视、阅读、工具、AI、资源搜索。",
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
 * 纯只读展示站（2026-08-21 重构）：数据由 page.tsx 服务端直读 Turso 数据库并 SSR 进首屏。
 * 无登录、无编辑、无同步 —— 数据由 navdata 工具链维护。
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={plusJakarta.variable}>
      <body className="antialiased">
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  );
}
