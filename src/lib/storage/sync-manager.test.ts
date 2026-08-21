import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveDataToDb } from "./db-storage";
import { clearLocalStorage, setLastSyncTime, type NavData } from "./local-storage";
import { resolveSyncDirection } from "./sync-manager";

vi.mock("./db-storage", () => ({
  getDataFromDb: vi.fn(),
  saveDataToDb: vi.fn(),
}));

const mockedSaveDataToDb = vi.mocked(saveDataToDb);

function navData(title: string, lastModified: number): NavData {
  return {
    version: "1.0",
    lastModified,
    categories: [
      {
        id: "default",
        name: "默认分类",
        sort: 0,
        sites: [
          {
            id: "site-1",
            title,
            url: "https://example.com",
          },
        ],
      },
    ],
  };
}

describe("resolveSyncDirection", () => {
  beforeEach(() => {
    clearLocalStorage();
    mockedSaveDataToDb.mockReset();
  });

  it("本地和数据库都基于上次同步版本变更时拒绝静默覆盖", async () => {
    const base = navData("Base", 100);
    const local = navData("Local", 300);
    const remote = navData("Remote", 200);
    setLastSyncTime(base);

    const result = await resolveSyncDirection(local, remote, "token", "test");

    expect(result.success).toBe(false);
    expect(result.error).toContain("同步冲突");
    expect(mockedSaveDataToDb).not.toHaveBeenCalled();
  });

  it("时间戳相同但内容不同会返回冲突", async () => {
    const local = navData("Local", 100);
    const remote = navData("Remote", 100);

    const result = await resolveSyncDirection(local, remote, "token", "test");

    expect(result.success).toBe(false);
    expect(result.error).toContain("时间戳相同但内容不同");
    expect(mockedSaveDataToDb).not.toHaveBeenCalled();
  });

  it("只有本地相对上次同步版本变更时仍然上传", async () => {
    const base = navData("Base", 100);
    const local = navData("Local", 300);
    setLastSyncTime(base);

    const result = await resolveSyncDirection(local, base, "token", "test");

    expect(result.success).toBe(true);
    expect(result.direction).toBe("upload");
    expect(mockedSaveDataToDb).toHaveBeenCalledOnce();
  });
});
