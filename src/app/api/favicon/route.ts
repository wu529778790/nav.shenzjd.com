import { NextRequest } from "next/server";
import { safeFetchExternalUrl } from "@/lib/server/safe-external-fetch";

const FALLBACK_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="fallback favicon"><rect width="64" height="64" rx="16" fill="#eef2ff"/><path d="M32 12c11.046 0 20 8.954 20 20s-8.954 20-20 20-20-8.954-20-20 8.954-20 20-20Zm0 4c-4.5 0-8.52 1.98-11.27 5.11h22.54C40.52 17.98 36.5 16 32 16Zm-14.68 9.11A15.93 15.93 0 0 0 16 32c0 2.36.51 4.6 1.42 6.61 2.1-.33 4.37-.59 6.75-.76A48.6 48.6 0 0 1 24 32c0-2.05.14-4 .32-5.89-2.38-.17-4.66-.42-7-.8Zm10.97-.55A44.72 44.72 0 0 0 28 32c0 2.64.12 5.15.34 7.44 1.2.04 2.42.06 3.66.06s2.46-.02 3.66-.06c.22-2.29.34-4.8.34-7.44 0-2.63-.12-5.13-.34-7.42A47.87 47.87 0 0 0 32 24.5c-1.24 0-2.46.02-3.66.06Zm11.39.35c.18 1.89.31 3.84.31 5.89 0 2.05-.13 4-.31 5.84 2.36.17 4.62.42 6.71.76A15.93 15.93 0 0 0 48 32c0-2.49-.57-4.86-1.58-6.97-2.08.37-4.34.63-6.72.78ZM20.73 42.9C23.48 46.02 27.5 48 32 48c4.5 0 8.52-1.98 11.27-5.1-2.13-.32-4.44-.56-6.88-.72-.7 3.61-1.88 5.82-3.4 5.82-1.52 0-2.7-2.21-3.4-5.82-2.44.16-4.75.4-6.88.72Z" fill="#4f46e5"/></svg>`;

function createFallbackResponse() {
  return new Response(FALLBACK_ICON_SVG, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function normalizeTarget(input: string): URL | null {
  try {
    const parsed = new URL(input);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function isAcceptableImageResponse(contentType: string, url: URL): boolean {
  if (contentType.startsWith("image/")) {
    return true;
  }

  if (contentType.includes("application/octet-stream")) {
    return /\.(ico|png|jpe?g|gif|webp|avif|svg)(\?.*)?$/i.test(url.pathname);
  }

  return false;
}

async function fetchFavicon(target: URL): Promise<Response> {
  return safeFetchExternalUrl(
    target,
    {
      signal: AbortSignal.timeout(8000),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; NavForestBot/1.0; +https://navhub.shenzjd.com)",
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
      // 不用 Next 的 fetch cache：外站 favicon 可能长时间无响应/超时，
      // 若启用 cache 会让 Next 在超时时尝试写入 data cache 失败并打
      // "Failed to set fetch cache" 噪音（见 data/*.log）。响应本身已带
      // 1 天 Cache-Control，浏览器/CDN 侧缓存足够。
      cache: "no-store",
    },
    { maxRedirects: 2 }
  );
}

export async function GET(request: NextRequest) {
  const rawSrc = request.nextUrl.searchParams.get("src")?.trim();
  if (!rawSrc) {
    return createFallbackResponse();
  }

  const target = normalizeTarget(rawSrc);
  if (!target) {
    return createFallbackResponse();
  }

  try {
    const response = await fetchFavicon(target);

    const contentType = response.headers.get("content-type")?.toLowerCase() || "";
    const responseUrl = new URL(response.url || target);
    if (!response.ok || !isAcceptableImageResponse(contentType, responseUrl)) {
      return createFallbackResponse();
    }

    return new Response(response.body, {
      status: 200,
      headers: {
        "Content-Type": contentType || "image/x-icon",
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return createFallbackResponse();
  }
}
