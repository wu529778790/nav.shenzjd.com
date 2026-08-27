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
    default: "导航森林",
    template: "%s | 导航森林",
  },
  description:
    "导航森林：个人导航书签聚合站，聚合影视、阅读、工具、AI、资源搜索等优质链接，支持全文搜索。",
  keywords: ["导航森林", "导航", "书签", "收藏夹", "资源", "神族九帝", "bookmark", "navigation"],
  authors: [{ name: "神族九帝" }],
  creator: "神族九帝",
  metadataBase: new URL("https://navhub.shenzjd.com"),
  openGraph: {
    type: "website",
    locale: "zh_CN",
    url: "https://navhub.shenzjd.com",
    siteName: "导航森林",
    title: "导航森林",
    description: "导航森林：聚合影视、阅读、工具、AI、资源搜索等优质链接。",
  },
  twitter: {
    card: "summary_large_image",
    title: "导航森林",
    description: "导航森林：聚合影视、阅读、工具、AI、资源搜索等优质链接。",
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

/** 全站 WebSite 结构化数据（JSON-LD，2026-08-24 SEO） */
const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "导航森林",
  url: "https://navhub.shenzjd.com",
  description:
    "导航森林：个人导航书签聚合站，聚合影视、阅读、工具、AI、资源搜索等优质链接。",
  inLanguage: "zh-CN",
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
    <html lang="zh-CN" className={plusJakarta.variable} suppressHydrationWarning>
      <head>
        {/* 防闪烁：hydration 前应用主题（localStorage 优先，缺省跟随系统）。
            放在 <head> 内保证在 body 解析前执行，且让 Next.js 知道 script 顺序；
            <html suppressHydrationWarning> 抑制 data-theme 在 SSR（无）与 hydration 前
            （script 已设置）之间的已知差异，这是 Next.js 官方 dark-mode 方案。 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme="light";}})();`,
          }}
        />
      </head>
      <body className="antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  );
}
