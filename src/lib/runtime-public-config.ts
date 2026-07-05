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
let runtimeConfigPromise: Promise<RuntimePublicConfig> | null = null;

/**
 * 读取运行时公开配置。
 *
 * 客户端走 /api/runtime-config 拉取，服务端 API 在运行时读取 process.env ——
 * 这让 Docker 部署可以在容器启动时通过环境变量注入 NEXT_PUBLIC_*，
 * 无需重新构建镜像。
 *
 * 模块级缓存保证整个页面生命周期只发一次请求。
 */
export async function getRuntimePublicConfig(): Promise<RuntimePublicConfig> {
  // 服务端：直接读 process.env
  if (typeof window === "undefined") {
    return getServerRuntimePublicConfig();
  }

  // 客户端命中缓存
  if (runtimeConfigCache) {
    return runtimeConfigCache;
  }

  // 去重：同一次页面生命周期只发一个请求
  if (!runtimeConfigPromise) {
    runtimeConfigPromise = fetch("/api/runtime-config", {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("获取运行时配置失败");
        }

        return (await response.json()) as RuntimePublicConfig;
      })
      .then((config) => {
        runtimeConfigCache = config;
        return config;
      })
      .finally(() => {
        runtimeConfigPromise = null;
      });
  }

  return runtimeConfigPromise;
}
