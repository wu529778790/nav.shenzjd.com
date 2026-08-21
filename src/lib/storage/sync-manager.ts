/**
 * 同步管理器
 * 管理本地存储和数据库（Turso）之间的同步
 *
 * 冲突检测优化：
 * 1. 使用内容指纹（而非仅时间戳）作为主要判断依据
 * 2. 引入版本号概念，避免毫秒级时间戳碰撞问题
 */

import {
  saveToLocalStorage,
  loadFromLocalStorage,
  setLastSyncTime,
  getDataFingerprint,
  getLastSyncedFingerprint,
} from "./local-storage";
import { saveDataToDb, getDataFromDb } from "./db-storage";
import { mergeNavData } from "./merge";
import { STORAGE_CONFIG, SYNC_CONFIG } from "@/lib/config";
import type { NavData, SyncResult, SyncStep, SyncStepInfo } from "@/types";
import { SyncStatus } from "@/types";

/** 版本号存储 key */
const VERSION_KEY = "nav_data_version";

/**
 * 解析 SyncOptions 中「可能是 getter 的 token」为实际的 string | undefined。
 *
 * 支持两种形态：
 * - string: 静态值（degraded 模式，向后兼容）
 * - () => string | undefined: getter，每次调用都重新求值（推荐，token 可能随 OAuth 更新）
 */
function resolveToken(token: SyncOptions["token"]): string | undefined {
  if (typeof token === "function") {
    const v = token();
    return v == null ? undefined : v;
  }
  return token;
}

/**
 * 获取当前数据版本号（递增整数）
 * 每次数据变更时递增，用于精确的冲突检测
 */
export function getDataVersion(): number {
  try {
    const version = localStorage.getItem(VERSION_KEY);
    return version ? parseInt(version, 10) : 0;
  } catch {
    return 0;
  }
}

/**
 * 递增并保存版本号
 * @returns 新的版本号
 */
export function incrementDataVersion(): number {
  const newVersion = getDataVersion() + 1;
  try {
    localStorage.setItem(VERSION_KEY, String(newVersion));
  } catch {
    // 忽略写入错误
  }
  return newVersion;
}

/** 同步时记录的版本信息 */
interface VersionRecord {
  /** 本地版本号 */
  localVersion: number;
  /** 远程版本号（从 GitHub 数据中读取） */
  remoteVersion: number;
}

const LAST_SYNC_VERSION_KEY = "nav_last_sync_version";

/**
 * 获取上次同步时的版本记录
 */
export function getLastSyncVersion(): VersionRecord | null {
  try {
    const raw = localStorage.getItem(LAST_SYNC_VERSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as VersionRecord;
  } catch {
    return null;
  }
}

/**
 * 保存同步版本记录
 */
export function saveSyncVersion(record: VersionRecord): void {
  try {
    localStorage.setItem(LAST_SYNC_VERSION_KEY, JSON.stringify(record));
  } catch {
    // 忽略写入错误
  }
}

/**
 * 检查本地数据是否为空（只有默认分类）
 */
function isLocalDataEmpty(data: NavData | null): boolean {
  return (
    !data ||
    !data.categories ||
    data.categories.length === 0 ||
    (data.categories.length === 1 &&
      data.categories[0].id === "default" &&
      data.categories[0].sites.length === 0)
  );
}

export class SyncConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SyncConflictError";
  }
}

// 类型已统一导出至 @/types，此处 re-export 以保持向后兼容
export type { SyncResult, SyncStep, SyncStepInfo } from "@/types";
export { SyncStatus } from "@/types";

/**
 * 增强的冲突检测
 *
 * 检测策略（按优先级）：
 * 1. **版本号比较**：如果双方版本号都高于上次同步记录 → 冲突
 * 2. **指纹比较**：如果双方指纹都不同于上次同步记录 → 冲突
 * 3. **时间戳兜底**：时间戳相同但指纹不同 → 可能冲突
 */
function getSyncConflictError(
  localData: NavData | null,
  remoteData: NavData | null
): string | null {
  const localFingerprint = getDataFingerprint(localData);
  const remoteFingerprint = getDataFingerprint(remoteData);
  const lastSyncedFingerprint = getLastSyncedFingerprint();
  const lastSyncVersion = getLastSyncVersion();

  // 基本校验
  if (!localData || !remoteData || !localFingerprint || !remoteFingerprint) {
    return null;
  }

  const currentLocalVersion = getDataVersion();
  const remoteVersion = (remoteData as unknown as Record<string, unknown>)._version as number | undefined;

  // 策略1: 版本号冲突检测（最可靠）
  if (lastSyncVersion && remoteVersion) {
    const localVersionIncreased = currentLocalVersion > lastSyncVersion.localVersion;
    const remoteVersionIncreased = remoteVersion > lastSyncVersion.remoteVersion;

    if (localVersionIncreased && remoteVersionIncreased) {
      return "检测到同步冲突：本地和远程数据都已修改，请先备份后手动合并";
    }
  }

  // 策略2: 指纹变化检测
  const bothChangedSinceLastSync =
    localFingerprint !== remoteFingerprint &&
    lastSyncedFingerprint &&
    localFingerprint !== lastSyncedFingerprint &&
    remoteFingerprint !== lastSyncedFingerprint;

  if (bothChangedSinceLastSync) {
    return "检测到同步冲突：本地和数据库数据都已修改，请先备份后手动合并";
  }

  // 策略3: 时间戳兜底检测（仅作为最后手段）
  const localTime = localData.lastModified || 0;
  const remoteTime = remoteData.lastModified || 0;

  // 排除默认空数据的情况（lastModified=0）
  if (
    localTime > 0 &&
    remoteTime > 0 &&
    localTime === remoteTime &&
    localFingerprint !== remoteFingerprint
  ) {
    return "检测到同步冲突：本地和数据库时间戳相同但内容不同，请手动合并";
  }

  return null;
}

/**
 * 冲突解决逻辑（共享）
 * 决定同步方向：upload / download / none
 */
export async function resolveSyncDirection(
  localData: NavData | null,
  remoteData: NavData | null,
  token: string,
  commitMessagePrefix: string
): Promise<SyncResult> {
  const isLocalEmpty = isLocalDataEmpty(localData);
  const conflictError = getSyncConflictError(localData, remoteData);
  if (conflictError) {
    return {
      success: false,
      direction: "none",
      conflictResolved: false,
      error: conflictError,
    };
  }

  // 情况 1: 本地为空，数据库有数据 → 下载
  if (isLocalEmpty && remoteData) {
    saveToLocalStorage(remoteData);
    // 记录远程版本号
    const remoteVersion = (remoteData as unknown as Record<string, unknown>)._version as number | undefined;
    if (remoteVersion) {
      incrementDataVersion();
      saveSyncVersion({ localVersion: getDataVersion(), remoteVersion });
    }
    setLastSyncTime(remoteData);
    return {
      success: true,
      direction: "download",
      message: "从数据库下载数据",
    };
  }

  // 情况 2: 数据库为空，本地有有效数据 → 上传
  if (remoteData === null && !isLocalEmpty && localData) {
    const newVersion = incrementDataVersion();
    // 在数据中嵌入版本号
    const dataWithVersion = { ...localData, _version: newVersion } as NavData;
    await saveDataToDb(dataWithVersion, `${commitMessagePrefix} ${new Date().toISOString()}`);
    
    const remoteVersion = (remoteData as unknown as Record<string, unknown>)._version as number | undefined;
    if (remoteVersion) {
      saveSyncVersion({ localVersion: newVersion, remoteVersion });
    }
    setLastSyncTime(localData);
    return {
      success: true,
      direction: "upload",
      message: "上传本地数据到数据库",
    };
  }

  // 情况 3: 双方都为空 → 无需操作
  if (isLocalEmpty && remoteData === null) {
    setLastSyncTime();
    return {
      success: true,
      direction: "none",
      message: "两端都为空，无需同步",
    };
  }

  // 情况 4: 双方都有有效数据，比较时间戳
  if (localData && remoteData && !isLocalEmpty) {
    const localTime = localData.lastModified || 0;
    const remoteTime = remoteData.lastModified || 0;

    if (localTime > remoteTime) {
      // 本地更新，上传
      const newVersion = incrementDataVersion();
      const dataWithVersion = { ...localData, _version: newVersion } as NavData;
      await saveDataToDb(dataWithVersion, `${commitMessagePrefix} ${new Date().toISOString()}`);
      
      const remoteVersion = (remoteData as unknown as Record<string, unknown>)._version as number | undefined;
      if (remoteVersion) {
        saveSyncVersion({ localVersion: newVersion, remoteVersion });
      }
      setLastSyncTime(localData);
      return {
        success: true,
        direction: "upload",
        message: "本地数据较新，已上传到数据库",
      };
    } else if (remoteTime > localTime) {
      // 数据库更新，下载
      saveToLocalStorage(remoteData);
      const remoteVersion = (remoteData as unknown as Record<string, unknown>)._version as number | undefined;
      if (remoteVersion) {
        incrementDataVersion();
        saveSyncVersion({ localVersion: getDataVersion(), remoteVersion });
      }
      setLastSyncTime(remoteData);
      return {
        success: true,
        direction: "download",
        message: "数据库数据较新，已下载到本地",
      };
    } else {
      // 时间戳相同，数据一致
      setLastSyncTime(localData);
      return {
        success: true,
        direction: "none",
        message: "数据已同步，无需更新",
      };
    }
  }

  // 理论上不应该到这里
  return {
    success: false,
    direction: "none",
    error: "未知的同步状态",
  };
}

interface SyncOptions {
  /**
   * 兼容旧接口保留的 token 参数（全站私有模式下恒为 "cookie" 哨兵值，
   * 数据读写由服务端完成，前端无需真实 token）。
   *
   * 哨兵值 "cookie" 表示 token 由服务端持有，前端无法读取，
   * getter 返回此值时守卫通过。
   */
  token?: string | (() => string | undefined | null);
  /** authenticity 标志。推荐用 getter，避免启/停同步时获取到过期状态。 */
  isAuthenticated?: boolean | (() => boolean);
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  onStatusChange?: (status: SyncStatus) => void;
  onStepChange?: (step: SyncStepInfo) => void;
}

const SYNC_STEPS: Record<SyncStep, string> = {
  prepare: "准备同步...",
  fetching: "获取远程数据...",
  comparing: "比较数据差异...",
  uploading: "上传数据到数据库...",
  downloading: "下载数据到本地...",
  merging: "合并数据...",
  done: "完成",
};

/**
 * 同步管理器类
 */
export class SyncManager {
  private queue: NavData[] = [];
  private timer: NodeJS.Timeout | null = null;
  private retryCountMap = new Map<string, number>();
  private retryTimers = new Set<NodeJS.Timeout>();
  private isSyncing = false;
  private status: SyncStatus = SyncStatus.IDLE;
  private options: SyncOptions = {};

  constructor(options?: SyncOptions) {
    this.options = options || {};
  }

  /**
   * 添加到同步队列（防抖）
   */
  sync(data: NavData): void {
    // 立即更新本地存储
    saveToLocalStorage(data);

    // 添加到队列
    this.queue.push(data);

    // 防抖处理
    this.debounceSync();
  }

  /**
   * 立即同步（用于关键操作）
   */
  async syncNow(data: NavData): Promise<void> {
    // 立即更新本地
    saveToLocalStorage(data);

    // 清空队列
    this.queue = [];

    // 立即执行同步
    await this.processQueueImmediate(data);
  }

  /**
   * 强制同步（不检查网络状态）
   */
  async forceSync(): Promise<void> {
    const data = loadFromLocalStorage();
    if (!data) return;

    await this.processQueueImmediate(data);
  }

  /**
   * 更新同步步骤
   */
  private updateStep(step: SyncStep, progress: number = 0): void {
    this.options.onStepChange?.({
      step,
      label: SYNC_STEPS[step],
      progress,
    });
  }

  /**
   * 双向同步（上传 + 下载 + 冲突检测）
   * 这是用户手动点击"同步"按钮时调用的方法
   */
  async bidirectionalSync(): Promise<SyncResult> {
    if (!resolveToken(this.options.token)) {
      return { success: false, direction: "none", error: "未登录" };
    }

    // 确保在浏览器环境
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      this.updateStatus(SyncStatus.OFFLINE);
      return { success: false, direction: "none", error: "当前离线" };
    }

    this.isSyncing = true;
    this.updateStatus(SyncStatus.SYNCING);

    try {
      // 1. 准备同步
      this.updateStep("prepare", 10);

      // 2. 获取本地数据
      this.updateStep("fetching", 30);
      const localData = loadFromLocalStorage();

      // 3. 获取数据库数据
      const remoteData = await getDataFromDb();
      this.updateStep("fetching", 50);

      // 4. 比较数据
      this.updateStep("comparing", 60);

      // 5. 检测冲突并解决
      const result = await this.resolveConflict(localData, remoteData);

      // 6. 更新状态
      if (result.success) {
        this.updateStep("done", 100);
        this.updateStatus(SyncStatus.IDLE);
        this.options.onSuccess?.();
      } else {
        this.updateStatus(SyncStatus.ERROR);
        this.options.onError?.(new Error(result.error || "同步失败"));
      }

      return result;
    } catch (error) {
      console.error("双向同步失败:", error);
      this.updateStatus(SyncStatus.ERROR);
      this.options.onError?.(error as Error);
      return { success: false, direction: "none", error: (error as Error).message };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * 冲突检测与解决
   * 规则：
   * 1. 本地为空（或只有默认分类）+ 数据库有数据 → 下载
   * 2. 数据库为空 + 本地有有效数据 → 上传
   * 3. 双方都为空 → 无需操作
   * 4. 双方都有数据 → 比较时间戳决定方向
   */
  private async resolveConflict(
    localData: NavData | null,
    remoteData: NavData | null
  ): Promise<SyncResult> {
    // 预测同步方向以更新 UI 状态
    const isLocalEmpty = isLocalDataEmpty(localData);
    const direction =
      isLocalEmpty && remoteData
        ? "download"
        : remoteData === null && !isLocalEmpty
          ? "upload"
          : "none";

    if (direction === "download") {
      this.updateStatus(SyncStatus.DOWNLOADING);
      this.updateStep("downloading", 70);
    } else if (direction === "upload") {
      this.updateStatus(SyncStatus.UPLOADING);
      this.updateStep("uploading", 70);
    }

    // 使用共享的同步逻辑
    const result = await resolveSyncDirection(
      localData,
      remoteData,
      resolveToken(this.options.token)!,
      `[skip ci] Sync`
    );

    if (result.success && result.direction !== "none") {
      this.updateStep("merging", 90);
    }

    return result;
  }

  /**
   * 防抖同步（3秒无新操作才同步）
   */
  private debounceSync(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.processQueue();
    }, STORAGE_CONFIG.SYNC_DEBOUNCE_MS);
  }

  /**
   * 处理同步队列
   */
  private async processQueue(): Promise<void> {
    if (this.queue.length === 0 || this.isSyncing) return;

    const latestData = this.queue[this.queue.length - 1];
    this.queue = [];

    await this.processQueueImmediate(latestData);
  }

  /**
   * 立即处理队列
   */
  private async processQueueImmediate(data: NavData): Promise<void> {
    // 检查网络状态（确保在浏览器环境）
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      this.updateStatus(SyncStatus.OFFLINE);
      return;
    }

    // 检查 token（每次调用都实时求值，支持 getter 形式）
    const liveToken = resolveToken(this.options.token);
    if (!liveToken) {
      this.updateStatus(SyncStatus.IDLE);
      return;
    }

    this.isSyncing = true;
    this.updateStatus(SyncStatus.SYNCING);

    try {
      // 读阶段：直接拉取数据库数据（无 fork 概念，数据库不存在初始化流程）
      let remoteData: NavData | null = null;
      try {
        remoteData = await getDataFromDb();
      } catch (readError) {
        // 读取失败（网络/服务错误）→ 抛出，写入也会失败，尽早失败更清晰
        throw readError;
      }

      // 字段级合并（pull-before-push）：
      // 无论是否存在版本号记录，都先把远端拉下来与本地合并，再整体回写两端。
      // 多设备各自新增不同站点 / 分类会自动合并，同 id 站点按 updatedAt last-writer-wins。
      const commitMessage = `[skip ci] Auto sync ${new Date().toISOString()}`;
      const newVersion = incrementDataVersion();
      const remoteVersion = (remoteData as unknown as { _version?: number })._version;

      if (remoteData) {
        const { merged, overlaps } = mergeNavData(data, remoteData);
        if (overlaps.length > 0) {
          console.info(
            `[SyncManager] 合并发现 ${overlaps.length} 处同 id 站点两端都改过，已按 updatedAt 取较新一方：${overlaps.join(", ")}`,
          );
        }
        merged._version = Math.max(newVersion, remoteVersion ?? 0);
        saveSyncVersion({ localVersion: newVersion, remoteVersion: remoteVersion ?? newVersion });

        // 写回本地 + 上传合并结果
        saveToLocalStorage(merged);
        await saveDataToDb(merged, commitMessage);
        setLastSyncTime(merged);
      } else {
        // 远端无数据（首次使用数据库）→ 直接上传本地
        const dataWithVersion = { ...data, _version: newVersion } as NavData;
        await saveDataToDb(dataWithVersion, commitMessage);
        saveSyncVersion({ localVersion: newVersion, remoteVersion: newVersion });
        setLastSyncTime(data);
      }

      this.retryCountMap.clear();
      this.updateStatus(SyncStatus.IDLE);
      this.options.onSuccess?.();
    } catch (error) {
      console.error("❌ 同步失败:", error);
      this.updateStatus(SyncStatus.ERROR);
      this.options.onError?.(error as Error);
      this.retrySync(data);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * 重试同步
   */
  private retrySync(data: NavData): void {
    const retryKey = String(data.lastModified);
    const currentRetryCount = this.retryCountMap.get(retryKey) ?? 0;

    if (currentRetryCount >= SYNC_CONFIG.MAX_RETRIES) {
      console.error(`❌ 同步重试超过上限(${SYNC_CONFIG.MAX_RETRIES})，停止自动重试`);
      this.retryCountMap.delete(retryKey);
      return;
    }

    const nextRetryCount = currentRetryCount + 1;
    this.retryCountMap.set(retryKey, nextRetryCount);

    // 指数退避 + 抖动，避免请求风暴
    const exponentialDelay = SYNC_CONFIG.RETRY_DELAY_MS * 2 ** (nextRetryCount - 1);
    const jitter = Math.floor(Math.random() * 500);
    const delay = exponentialDelay + jitter;

    const retryTimer = setTimeout(() => {
      this.retryTimers.delete(retryTimer);
      this.queue.push(data);
      this.processQueue();
    }, delay);

    this.retryTimers.add(retryTimer);
  }

  /**
   * 更新状态
   */
  private updateStatus(status: SyncStatus): void {
    this.status = status;
    this.options.onStatusChange?.(status);
  }

  /**
   * 获取当前状态
   */
  getStatus(): SyncStatus {
    return this.status;
  }

  /**
   * 清理资源
   */
  destroy(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    for (const retryTimer of this.retryTimers) {
      clearTimeout(retryTimer);
    }
    this.retryTimers.clear();
    this.retryCountMap.clear();
  }
}

/**
 * 一次性同步（用于首次加载）
 */
export async function initialSync(token?: string): Promise<NavData | null> {
  // 1. 检查本地缓存
  const localData = loadFromLocalStorage();
  if (localData) {
    return localData;
  }

  // 2. 从数据库拉取
  if (token) {
    try {
      const { getDataFromDb } = await import("./db-storage");
      const remoteData = await getDataFromDb();
      if (remoteData) {
        // 保存到本地
        saveToLocalStorage(remoteData);
        setLastSyncTime(remoteData);
        return remoteData;
      }
    } catch (error) {
      console.error("从数据库拉取失败:", error);
    }
  }

  // 3. 返回空数据
  return {
    version: "1.0",
    lastModified: Date.now(),
    categories: [],
  };
}

