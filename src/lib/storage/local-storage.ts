/**
 * 本地存储管理器
 * 管理 localStorage 中的数据
 */

import { STORAGE_CONFIG } from "@/lib/config";
import type { Category, NavData } from "@/types";

const STORAGE_KEY = "nav_data";
const LAST_SYNC_KEY = "nav_last_sync";
const LAST_SYNC_FINGERPRINT_KEY = "nav_last_sync_fingerprint";
const EXPIRY_KEY = "nav_expiry";
const CACHE_DURATION = STORAGE_CONFIG.CACHE_DURATION;

/**
 * 是否处于可访问 localStorage 的环境（浏览器）。
 *
 * SSR 期间 window / localStorage 不存在。DataContext 的 useState 初始化器
 * 会在服务端执行并调用 loadFromLocalStorage，若直接访问 localStorage 会抛
 * ReferenceError 并被 catch 成 console.error —— 每次首页请求刷 2 条错误日志。
 * 此守卫让服务端静默返回，消除日志噪音。
 */
function hasLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

// 类型已统一导出至 @/types，此处 re-export 以保持向后兼容
export type { Site, Category, NavData } from "@/types";

/**
 * 保存数据到 localStorage
 */
export function saveToLocalStorage(data: NavData): void {
  if (!hasLocalStorage()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    localStorage.setItem(EXPIRY_KEY, (Date.now() + CACHE_DURATION).toString());
  } catch (error) {
    console.error("保存到 localStorage 失败:", error);
    throw new Error("本地存储空间不足");
  }
}

/**
 * 从 localStorage 读取数据
 */
export function loadFromLocalStorage(): NavData | null {
  // SSR 期间静默返回 null（见上方 hasLocalStorage 注释），不打错误日志
  if (!hasLocalStorage()) return null;
  try {
    const expiry = localStorage.getItem(EXPIRY_KEY);
    if (!expiry) return null;

    if (Date.now() > parseInt(expiry)) {
      clearLocalStorage();
      return null;
    }

    const cached = localStorage.getItem(STORAGE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error("从 localStorage 读取失败:", error);
    return null;
  }
}

/**
 * 清除 localStorage 数据（别名，保留向后兼容）
 */
export function clearLocalStorage(): void {
  if (!hasLocalStorage()) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LAST_SYNC_KEY);
    localStorage.removeItem(LAST_SYNC_FINGERPRINT_KEY);
    localStorage.removeItem(EXPIRY_KEY);
  } catch (error) {
    console.error("清除 localStorage 失败:", error);
  }
}

/**
 * 清空前用户的全部导航相关 localStorage。
 *
 * 在用户切换（登录不同 GitHub 账户）或登出时调用，防止新登录用户
 * 读到旧用户残留数据后被当作"本地有效"触发伪·upload。
 *
 * 仅操作 nav_ 前缀的 key，避免影响其他应用级缓存（如主题）。
 */
export function clearAllNavLocalStorage(): void {
  if (!hasLocalStorage()) return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key === STORAGE_KEY || key.startsWith("nav_"))) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  } catch (error) {
    console.error("清空 nav_* localStorage 失败:", error);
  }
}

/**
 * 判断本地数据是否「有效」（值得用来做首屏秒开）。
 *
 * 兜底写入的「空的默认分类」被视为无效：它没有真实站点，
 * 如果当作有效数据用，就会让访客再也无法触发远程拉取示例数据
 * （历史上导致「打开永远显示空」的死循环）。
 */
export function isLocalDataValid(data: NavData | null): boolean {
  if (!data?.categories || data.categories.length === 0) return false;

  // 仅有一个空的默认分类（初始化兜底产物）→ 视为无效，触发远程拉取
  const only = data.categories[0];
  const isDefaultEmpty =
    data.categories.length === 1 &&
    only.id === "default" &&
    only.sites.length === 0;
  return !isDefaultEmpty;
}

/**
 * 获取数据指纹。忽略 lastModified，只比较实际导航内容。
 */
export function getDataFingerprint(data: NavData | null): string | null {
  if (!data) return null;
  return JSON.stringify({
    version: data.version,
    categories: data.categories,
  });
}

/**
 * 获取上一次成功同步时的数据指纹。
 */
export function getLastSyncedFingerprint(): string | null {
  try {
    return localStorage.getItem(LAST_SYNC_FINGERPRINT_KEY);
  } catch {
    return null;
  }
}

/**
 * 获取最后修改时间
 */
export function getLastModified(): number | null {
  try {
    const data = loadFromLocalStorage();
    return data?.lastModified || null;
  } catch {
    return null;
  }
}

/**
 * 获取最后同步时间
 */
export function getLastSyncTime(): Date | null {
  try {
    const timestamp = localStorage.getItem(LAST_SYNC_KEY);
    return timestamp ? new Date(parseInt(timestamp)) : null;
  } catch {
    return null;
  }
}

/**
 * 设置最后同步时间
 */
export function setLastSyncTime(data?: NavData): void {
  if (!hasLocalStorage()) return;
  try {
    localStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
    const fingerprint = data ? getDataFingerprint(data) : null;
    if (fingerprint) {
      localStorage.setItem(LAST_SYNC_FINGERPRINT_KEY, fingerprint);
    } else {
      localStorage.removeItem(LAST_SYNC_FINGERPRINT_KEY);
    }
  } catch (error) {
    console.error("设置同步时间失败:", error);
  }
}

/**
 * 检查数据是否过期
 */
export function isExpired(): boolean {
  try {
    const expiry = localStorage.getItem(EXPIRY_KEY);
    if (!expiry) return true;
    return Date.now() > parseInt(expiry);
  } catch {
    return true;
  }
}

/**
 * 获取站点数据（兼容现有代码）
 */
export function getSitesFromLocalStorage(): Category[] {
  const data = loadFromLocalStorage();
  return data?.categories || [];
}

/**
 * 保存站点数据（兼容现有代码）
 */
export function saveSitesToLocalStorage(categories: Category[]): void {
  // 检查是否是初始化的空默认分类
  const isDefaultEmpty =
    categories.length === 1 && categories[0].id === "default" && categories[0].sites.length === 0;

  const data: NavData = {
    version: "1.0",
    // 如果是空的默认分类，写一个很老的时间戳（1970年），强制后续走 GitHub 拉取
    // 如果有真实数据，写当前时间戳
    lastModified: isDefaultEmpty ? 0 : Date.now(),
    categories,
  };
  saveToLocalStorage(data);
}
