import { NextResponse } from "next/server";
import { getAuthenticatedUserFromCookie, getTokenFromCookie } from "@/lib/server/github";

// 鉴权 API 必须实时读 cookie 直达源站，禁止被浏览器/CDN 缓存
export const dynamic = "force-dynamic";

export async function GET() {
  const token = await getTokenFromCookie();
  if (!token) {
    return NextResponse.json(
      { authenticated: false, user: null },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const user = await getAuthenticatedUserFromCookie();
    return NextResponse.json(
      { authenticated: true, user },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { authenticated: false, user: null },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }
}
