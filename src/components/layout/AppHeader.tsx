/**
 * 应用头部（2026-08-21 树形导航站重构）
 *
 * Vercel 极简：64px 白底 + Logo（黑方块 + 文字）+ 全局搜索框（⌘K 胶囊）。
 * 搜索状态由 HomeClient 持有，通过 props 传入。
 */

"use client";

import { useRef } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";

interface AppHeaderProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  /** 点击 logo 跳转到第一个顶级分类（由 HomeClient 处理） */
  onLogoClick?: () => void;
}

export function AppHeader({ searchValue, onSearchChange, onLogoClick }: AppHeaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <header className="sticky top-0 z-[45] h-16 w-full border-b border-[var(--border)] bg-[var(--background-secondary)]">
      <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between gap-4 px-4 md:px-6">
        {/* Logo：点击跳转到第一个顶级分类（2026-08-22 用户拍板） */}
        <Link
          href="/"
          onClick={(e) => {
            e.preventDefault();
            onLogoClick?.();
          }}
          className="flex flex-shrink-0 items-center gap-2.5"
          aria-label="神族九帝的收藏夹首页"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] bg-[var(--neutral-900)]">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden
            >
              <path
                d="M3 6.5C3 5.67 3.67 5 4.5 5H9.5L11.5 7H19.5C20.33 7 21 7.67 21 8.5V17.5C21 18.33 20.33 19 19.5 19H4.5C3.67 19 3 18.33 3 17.5V6.5Z"
                fill="#FFD400"
              />
            </svg>
          </span>
          <span className="text-lg font-bold tracking-tight text-[var(--foreground)]">
            神族九帝的收藏夹
          </span>
        </Link>

        {/* 全局搜索框 */}
        <div className="flex min-w-0 flex-1 justify-end">
          <div className="flex h-10 w-full max-w-md items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--muted)] px-3 transition-colors focus-within:border-[var(--neutral-900)]">
            {" "}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="flex-shrink-0 text-[var(--muted-foreground)]"
              aria-hidden
            >
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path
                d="M16.5 16.5L21 21"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="搜索分类或网站…"
              aria-label="全局搜索"
              className="min-w-0 flex-1 bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]"
            />
            <kbd className="hidden flex-shrink-0 items-center justify-center rounded-[var(--radius-xs)] border border-[var(--border)] bg-[var(--background-secondary)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--muted-foreground)] sm:flex">
              ⌘K
            </kbd>
          </div>
        </div>

        {/* 深浅色模式切换 */}
        <ThemeToggle />
      </div>
    </header>
  );
}
