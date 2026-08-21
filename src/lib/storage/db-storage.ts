/**
 * 数据库存储管理器（前端）
 * 通过内部 API 访问 Turso (libsql) 数据库。
 * 全站私有模式：无登录，直接读写服务端数据库。
 */

import type { NavData } from "@/types";

export async function getDataFromDb(): Promise<NavData | null> {
  const response = await fetch("/api/data", {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("读取数据库数据失败");
  }

  const payload = (await response.json()) as { data: NavData | null };
  return payload.data;
}

export async function saveDataToDb(data: NavData, message?: string): Promise<void> {
  const response = await fetch("/api/data", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data, message }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({ error: "保存到数据库失败" }))) as {
      error?: string;
    };
    throw new Error(payload.error || "保存到数据库失败");
  }
}
