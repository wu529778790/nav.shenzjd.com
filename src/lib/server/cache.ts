/**
 * 服务端内存 TTL 缓存（globalThis 单例 + 单飞）
 *
 * 背景：首页 SSR 每次访问都直读 Turso（导航数据 3 条 batch + 失效标注 2 条），
 * 而导航数据是低频更新的静态内容。部署形态为单实例 Docker 容器，
 * 进程内缓存即可覆盖全部读流量，把数据库读量降到接近 0。
 *
 * 设计：
 * - globalThis 挂载：Next dev HMR / 模块重复加载时仍共享同一份缓存；
 * - TTL 过期：惰性过期（读取时校验），无需定时器；
 * - 单飞（single-flight）：缓存刚过期瞬间的高并发，只允许一个 loader
 *   真实读库，其余请求复用同一个 Promise，避免缓存击穿；
 * - 写后失效：数据变更方（writeNavData / 报失效 / 后台管理）主动 invalidate，
 *   让前台改动立即可见；TTL 仅作为兜底（如独立进程导入脚本改库的场景）。
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

interface CacheStore {
  entries: Map<string, CacheEntry<unknown>>;
  inflight: Map<string, Promise<unknown>>;
}

/** 默认 TTL：5 分钟（导航数据由导入脚本低频更新，完全够用） */
export const DEFAULT_TTL_MS = 5 * 60 * 1000;

function getStore(): CacheStore {
  const g = globalThis as unknown as { __navCacheStore?: CacheStore };
  g.__navCacheStore ??= { entries: new Map(), inflight: new Map() };
  return g.__navCacheStore;
}

/** 读取缓存（未命中 / 已过期返回 undefined；惰性过期，不启动定时器） */
export function cacheGet<T>(key: string): T | undefined {
  const entry = getStore().entries.get(key);
  if (!entry) return undefined;
  if (Date.now() >= entry.expiresAt) {
    getStore().entries.delete(key);
    return undefined;
  }
  return entry.value as T;
}

/** 写入缓存（覆盖旧的 TTL） */
export function cacheSet<T>(key: string, value: T, ttlMs: number = DEFAULT_TTL_MS): void {
  getStore().entries.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/** 主动失效（数据变更后调用；同时丢弃正在飞行的刷新，避免旧数据回写覆盖新值） */
export function cacheInvalidate(key: string): void {
  const store = getStore();
  store.entries.delete(key);
  store.inflight.delete(key);
}

/**
 * 带单飞的缓存读取：未命中时只允许一个 loader 执行，其余并发请求复用其结果。
 * 注意：缓存值允许为 null，但不能为 undefined（undefined 视为未命中、不缓存）。
 */
export async function cacheGetOrLoad<T>(
  key: string,
  loader: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<T> {
  const hit = cacheGet<T>(key);
  if (hit !== undefined) return hit;

  const store = getStore();
  const inflight = store.inflight.get(key) as Promise<T> | undefined;
  if (inflight) return inflight;

  const promise = loader()
    .then((value) => {
      // 只有自己仍是当前飞行任务时才回写：若期间被 invalidate 摘掉，
      // 说明数据已变更，丢弃这次旧结果，避免旧数据回写覆盖新值。
      if (store.inflight.get(key) === promise) {
        cacheSet(key, value, ttlMs);
      }
      return value;
    })
    .finally(() => {
      if (store.inflight.get(key) === promise) {
        store.inflight.delete(key);
      }
    });
  store.inflight.set(key, promise);
  return promise;
}
