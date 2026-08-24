import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cacheGet, cacheGetOrLoad, cacheInvalidate, cacheSet } from "@/lib/server/cache";

// 每个用例前重置 globalThis 缓存，避免用例间串数据
beforeEach(() => {
  const g = globalThis as unknown as { __navCacheStore?: unknown };
  delete g.__navCacheStore;
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("cache", () => {
  it("命中已缓存的值", () => {
    cacheSet("k", { a: 1 });
    expect(cacheGet("k")).toEqual({ a: 1 });
  });

  it("未命中的键返回 undefined", () => {
    expect(cacheGet("missing")).toBeUndefined();
  });

  it("TTL 过期后失效（惰性过期）", () => {
    cacheSet("k", "v", 1000);
    expect(cacheGet("k")).toBe("v");
    vi.advanceTimersByTime(1001);
    expect(cacheGet("k")).toBeUndefined();
  });

  it("单飞：并发读取只执行一次 loader", async () => {
    const loader = vi.fn(async () => "data");

    // 同一时刻发起 3 个并发读取
    const results = await Promise.all([
      cacheGetOrLoad("k", loader),
      cacheGetOrLoad("k", loader),
      cacheGetOrLoad("k", loader),
    ]);

    expect(results).toEqual(["data", "data", "data"]);
    expect(loader).toHaveBeenCalledTimes(1);
    // 结果已回写，后续读取直接命中
    expect(await cacheGetOrLoad("k", loader)).toBe("data");
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("invalidate 后重新加载", async () => {
    const loader = vi.fn(async () => "v1");
    expect(await cacheGetOrLoad("k", loader)).toBe("v1");

    cacheInvalidate("k");
    loader.mockResolvedValue("v2");
    expect(await cacheGetOrLoad("k", loader)).toBe("v2");
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("invalidate 时飞行中的 loader 完成不回写旧值", async () => {
    let resolveLoader!: (v: string) => void;
    const loader = vi.fn(() => new Promise<string>((resolve) => (resolveLoader = resolve)));

    // 触发一次未命中的加载并挂起
    const pending = cacheGetOrLoad("k", loader);
    // 等待 loader 被调用、inflight 已挂起
    await vi.advanceTimersByTimeAsync(0);

    // 数据变更：失效缓存（同时摘掉飞行任务）
    cacheInvalidate("k");

    // 旧 loader 此刻才完成（读的是旧库）
    resolveLoader("stale");
    await pending;

    // 旧结果不应回写：下一次读取必须重新走 loader
    const loader2 = vi.fn(async () => "fresh");
    expect(await cacheGetOrLoad("k", loader2)).toBe("fresh");
    expect(loader2).toHaveBeenCalledTimes(1);
  });

  it("缓存值为 null 时仍视为命中（readNavData 空库场景）", async () => {
    const loader = vi.fn(async () => null);
    expect(await cacheGetOrLoad("k", loader)).toBeNull();
    expect(await cacheGetOrLoad("k", loader)).toBeNull();
    expect(loader).toHaveBeenCalledTimes(1);
  });
});
