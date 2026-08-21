import { NextRequest, NextResponse } from "next/server";
import { readNavData, writeNavData } from "@/lib/server/turso";
import { validateOrigin, checkRateLimit, getClientIP } from "@/lib/security";
import { categorySchema } from "@/lib/validation";
import type { NavData } from "@/types";

function sanitizeErrorMessage(error: unknown): { message: string; status: number } {
  if (!(error instanceof Error)) {
    return { message: "操作失败", status: 500 };
  }
  return { message: "操作失败，请稍后重试", status: 500 };
}

export async function GET(request: NextRequest) {
  try {
    const clientIP = getClientIP(request);
    const rateLimit = checkRateLimit(clientIP, 60, 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "请求过于频繁，请稍后再试" },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)),
          },
        }
      );
    }

    const data = await readNavData();
    return NextResponse.json(
      { data, storage: "turso" },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const { message, status } = sanitizeErrorMessage(error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const clientIP = getClientIP(request);
    const rateLimit = checkRateLimit(clientIP, 20, 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "请求过于频繁，请稍后再试" }, { status: 429 });
    }

    if (!validateOrigin(request)) {
      return NextResponse.json({ error: "非法请求来源" }, { status: 403 });
    }

    const body = (await request.json()) as { data?: NavData; message?: string };
    if (!body?.data) {
      return NextResponse.json({ error: "缺少 data 参数" }, { status: 400 });
    }

    // 校验每个分类（含嵌套站点）
    const validatedCategories = body.data.categories.map((cat) => categorySchema.parse(cat));

    await writeNavData({ ...body.data, categories: validatedCategories });
    return NextResponse.json({ success: true, storage: "turso" });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ error: "数据格式无效" }, { status: 400 });
    }
    const { message, status } = sanitizeErrorMessage(error);
    return NextResponse.json({ error: message }, { status });
  }
}
