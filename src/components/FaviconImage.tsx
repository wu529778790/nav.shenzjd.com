"use client";

import Image from "next/image";
import { Globe, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { getRenderableFaviconUrl } from "@/lib/favicon-url";

interface FaviconImageProps {
  src?: string;
  alt: string;
  fill?: boolean;
  size?: number;
  imageClassName?: string;
  fallbackClassName?: string;
  iconClassName?: string;
}

/**
 * 跨组件实例的「已加载」会话缓存：
 * 同一 favicon URL 在本会话成功加载过一次后，后续任意重挂载
 * （如 StaticBoard → SortableBoard 切换、网格/列表视图切换、编辑后重渲染）
 * 都不再显示加载小转圈，避免首屏出现「满屏 loading 框」的观感。
 */
const loadedFavicons = new Set<string>();

export function FaviconImage({
  src,
  alt,
  fill = false,
  size = 24,
  imageClassName,
  fallbackClassName,
  iconClassName,
}: FaviconImageProps) {
  const resolvedSrc = useMemo(() => getRenderableFaviconUrl(src), [src]);
  const [failedSrc, setFailedSrc] = useState<string | undefined>();
  // 若该 favicon 已在本会话加载过，初始即不显示 spinner（避免重复转圈）
  const [isLoading, setIsLoading] = useState(
    () => (resolvedSrc ? !loadedFavicons.has(resolvedSrc) : false)
  );
  const shouldShowImage = Boolean(resolvedSrc) && failedSrc !== resolvedSrc;

  const handleLoad = () => {
    if (resolvedSrc) loadedFavicons.add(resolvedSrc);
    setIsLoading(false);
  };
  const handleError = () => {
    if (resolvedSrc) setFailedSrc(resolvedSrc);
    setIsLoading(false);
  };

  if (shouldShowImage) {
    if (fill) {
      return (
        <>
          {isLoading && (
            <div className={cn("absolute inset-0 flex items-center justify-center animate-pulse", fallbackClassName)}>
              <Loader2 className={cn("w-4 h-4 animate-spin text-[var(--muted-foreground)]", iconClassName)} />
            </div>
          )}
          <Image
            src={resolvedSrc!}
            alt={alt}
            fill
            className={cn(imageClassName, isLoading && "opacity-0")}
            unoptimized
            onLoad={handleLoad}
            onError={handleError}
          />
        </>
      );
    }

    return (
      <>
        {isLoading && (
          <div className={cn("flex items-center justify-center animate-pulse", fallbackClassName)}>
            <Loader2 className={cn("w-4 h-4 animate-spin text-[var(--muted-foreground)]", iconClassName)} />
          </div>
        )}
        <Image
          src={resolvedSrc!}
          alt={alt}
          width={size}
          height={size}
          className={cn(imageClassName, isLoading && "opacity-0")}
          unoptimized
          onLoad={handleLoad}
          onError={handleError}
        />
      </>
    );
  }

  return (
    <div className={cn("w-full h-full flex items-center justify-center", fallbackClassName)}>
      <Globe className={cn("w-4 h-4", iconClassName)} />
    </div>
  );
}
