// @vitest-environment node

/**
 * SSR 环境模拟测试（node 环境，无 window / localStorage）。
 *
 * 验证：服务端渲染时调用 loadFromLocalStorage 等本地存储函数，
 * 必须静默返回 null / 空操作，且【不打印任何错误日志】，
 * 消除历史日志里满屏的「从 localStorage 读取失败: ReferenceError: localStorage is not defined」。
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  loadFromLocalStorage,
  saveToLocalStorage,
  clearLocalStorage,
  clearAllNavLocalStorage,
  setLastSyncTime,
} from "@/lib/storage/local-storage";

describe("local-storage 在 SSR（无 window）环境下静默", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("loadFromLocalStorage 返回 null 且不打错误日志", () => {
    const result = loadFromLocalStorage();
    expect(result).toBeNull();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("saveToLocalStorage 静默 no-op，不抛错不打日志", () => {
    expect(() =>
      saveToLocalStorage({
        version: "1.0",
        lastModified: Date.now(),
        categories: [],
      })
    ).not.toThrow();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("clearLocalStorage / clearAllNavLocalStorage / setLastSyncTime 静默 no-op", () => {
    expect(() => clearLocalStorage()).not.toThrow();
    expect(() => clearAllNavLocalStorage()).not.toThrow();
    expect(() => setLastSyncTime()).not.toThrow();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
