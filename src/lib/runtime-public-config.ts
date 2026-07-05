export interface RuntimePublicConfig {
  githubClientId: string;
  githubOwner: string;
  githubRepo: string;
  dataFilePath: string;
}

export function buildRuntimePublicConfig(
  env: Record<string, string | undefined>
): RuntimePublicConfig {
  return {
    githubClientId: env.NEXT_PUBLIC_GITHUB_CLIENT_ID || "",
    githubOwner: env.NEXT_PUBLIC_GITHUB_OWNER || "wu529778790",
    githubRepo: env.NEXT_PUBLIC_GITHUB_REPO || "navhub.shenzjd.com",
    dataFilePath: env.NEXT_PUBLIC_DATA_FILE_PATH || "data/sites.json",
  };
}

export function getServerRuntimePublicConfig(): RuntimePublicConfig {
  return buildRuntimePublicConfig(process.env);
}

let runtimeConfigCache: RuntimePublicConfig | null = null;

/**
 * 读取运行时公开配置（githubClientId / owner / repo / dataFilePath）。
 *
 * 客户端直接读 NEXT_PUBLIC_* 环境变量（构建时内联，零网络请求）；
 * 服务端读 process.env。两种路径都走相同兜底值，默认行为一致。
 */
export async function getRuntimePublicConfig(): Promise<RuntimePublicConfig> {
  // 服务端：直接读 process.env
  if (typeof window === "undefined") {
    return getServerRuntimePublicConfig();
  }

  // 客户端：NEXT_PUBLIC_* 在构建时已内联，直接同步读取，无 HTTP 请求
  if (runtimeConfigCache) {
    return runtimeConfigCache;
  }

  const config: RuntimePublicConfig = {
    githubClientId: process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID || "",
    githubOwner: process.env.NEXT_PUBLIC_GITHUB_OWNER || "wu529778790",
    githubRepo: process.env.NEXT_PUBLIC_GITHUB_REPO || "navhub.shenzjd.com",
    dataFilePath: process.env.NEXT_PUBLIC_DATA_FILE_PATH || "data/sites.json",
  };

  runtimeConfigCache = config;
  return config;
}
