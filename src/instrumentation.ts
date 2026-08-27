/**
 * Next.js 启动钩子（instrumentation hook）
 *
 * 容器启动时主动预热导航数据缓存：读一次 DB 填充进程内缓存（cache.ts），
 * 之后所有 SSR 访问命中内存缓存，零 DB 读。失效时（Agent 写 / 报失效）
 * invalidateNavCache 清缓存，下次访问重读 DB，闭环可控。
 *
 * 设计要点：
 * - 只在 Node.js runtime 预热：Edge runtime 无 libsql 客户端；
 * - 失败不阻塞启动：预热失败降级为惰性加载（首次访问触发读 DB），
 *   保证容器即便 DB 暂时不可达也能起来；
 * - 用动态 import：instrumentation 在启动早期执行，动态 import 更安全。
 */

export async function register() {
  // 只在 Node.js runtime 预热（Edge runtime 无 libsql）
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const { readNavData } = await import("@/lib/server/turso");
    const { getReportCounts } = await import("@/lib/server/reports");
    // 并行预热：导航数据（6h TTL）+ 报失效聚合（1h TTL）
    await Promise.all([
      readNavData().catch((e) => {
        console.error("[instrumentation] 导航数据预热失败:", e);
      }),
      getReportCounts().catch((e) => {
        console.error("[instrumentation] 报失效聚合预热失败:", e);
      }),
    ]);
    console.log("[instrumentation] 缓存预热完成（导航数据 + 报失效聚合）");
  } catch (error) {
    // 预热失败不阻塞启动，降级为惰性加载（首次访问触发）
    console.error("[instrumentation] 启动预热失败，降级为惰性加载:", error);
  }
}
