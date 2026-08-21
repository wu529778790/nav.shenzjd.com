/**
 * 统一类型定义
 * 所有核心数据模型集中管理，避免分散重复定义
 */

/** 站点/书签 */
export interface Site {
  id: string;
  title: string;
  url: string;
  favicon?: string;
  description?: string;
  sort?: number;
  createdAt?: string;
  updatedAt?: string;
  /** 墓碑标记：删除时不真删，而是打标，让删除跨设备传播 */
  _deleted?: boolean;
  /** 删除时间（ISO 字符串），用于合并时取较新的删除事实 */
  deletedAt?: string;
}

/** 分类 */
export interface Category {
  id: string;
  name: string;
  icon?: string;
  sort: number;
  sites: Site[];
  /** 最后修改时间（ISO 字符串），用于 merge 时 last-writer-wins */
  updatedAt?: string;
  /** 墓碑标记：分类级删除同样需要跨设备传播 */
  _deleted?: boolean;
  deletedAt?: string;
}

/** 导航数据根结构 */
export interface NavData {
  version: string;
  lastModified: number;
  categories: Category[];
  /** 内部版本号（用于冲突检测，不暴露给用户） */
  _version?: number;
}

/** 运行时公共配置 */
export interface RuntimePublicConfig {
  githubOwner: string;
  githubRepo: string;
}
