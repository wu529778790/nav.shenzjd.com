import { describe, it, expect } from "vitest";
import type { NavData, Site } from "@/types";
import { mergeNavData } from "../merge";

function site(id: string, over: Partial<Site> = {}): Site {
  return {
    id,
    title: `site-${id}`,
    url: `https://example.com/${id}`,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

function nav(lastModified: number, categories: NavData["categories"]): NavData {
  return { version: "1.0", lastModified, categories };
}

describe("mergeNavData", () => {
  it("合并两端各自新增的不同站点（并集，不误判冲突）", () => {
    const local = nav(100, [
      { id: "c1", name: "C1", sort: 1, sites: [site("a")] },
    ]);
    const remote = nav(200, [
      { id: "c1", name: "C1", sort: 1, sites: [site("b")] },
    ]);

    const { merged, overlaps } = mergeNavData(local, remote);

    expect(overlaps).toHaveLength(0);
    const c1 = merged.categories.find((c) => c.id === "c1")!;
    expect(c1.sites.map((s) => s.id).sort()).toEqual(["a", "b"]);
  });

  it("合并两端各自新增的不同分类", () => {
    const local = nav(100, [{ id: "c1", name: "C1", sort: 1, sites: [site("a")] }]);
    const remote = nav(200, [{ id: "c2", name: "C2", sort: 2, sites: [site("b")] }]);

    const { merged, overlaps } = mergeNavData(local, remote);

    expect(overlaps).toHaveLength(0);
    expect(merged.categories.map((c) => c.id).sort()).toEqual(["c1", "c2"]);
  });

  it("同一 site.id 两端都改过 → 按 updatedAt 取较新一方，并记录 overlap", () => {
    const local = nav(100, [
      { id: "c1", name: "C1", sort: 1, sites: [site("a", { title: "local-title", updatedAt: "2026-01-01T00:00:00.000Z" })] },
    ]);
    const remote = nav(200, [
      { id: "c1", name: "C1", sort: 1, sites: [site("a", { title: "remote-title", updatedAt: "2026-03-01T00:00:00.000Z" })] },
    ]);

    const { merged, overlaps } = mergeNavData(local, remote);

    expect(overlaps).toEqual(["c1/a"]);
    const s = merged.categories[0].sites.find((x) => x.id === "a")!;
    expect(s.title).toBe("remote-title");
  });

  it("远端有更新的站点、本地未改 → 采用远端，同时保留本地独有站点", () => {
    const local = nav(100, [
      {
        id: "c1",
        name: "C1",
        sort: 1,
        sites: [
          site("shared", { title: "local-old", updatedAt: "2026-01-01T00:00:00.000Z" }),
          site("only-local"),
        ],
      },
    ]);
    const remote = nav(300, [
      {
        id: "c1",
        name: "C1",
        sort: 1,
        sites: [site("shared", { title: "remote-new", updatedAt: "2026-02-01T00:00:00.000Z" })],
      },
    ]);

    const { merged, overlaps } = mergeNavData(local, remote);

    const c1 = merged.categories[0];
    expect(c1.sites.map((s) => s.id).sort()).toEqual(["only-local", "shared"]);
    expect(c1.sites.find((s) => s.id === "shared")!.title).toBe("remote-new");
    // 同一 site.id 两端标题不同 → 记为 overlap（按 updatedAt 取较新的远端）
    expect(overlaps).toEqual(["c1/shared"]);
  });

  it("无重叠时 overlaps 为空且 lastModified 取较大值", () => {
    const local = nav(500, [{ id: "c1", name: "C1", sort: 1, sites: [site("a")] }]);
    const remote = nav(100, [{ id: "c2", name: "C2", sort: 2, sites: [site("b")] }]);

    const { merged, overlaps } = mergeNavData(local, remote);

    expect(overlaps).toHaveLength(0);
    expect(merged.lastModified).toBe(500);
    expect(merged.categories).toHaveLength(2);
  });

  it("同一 site.id 内容完全相同（仅一端有 updatedAt）→ 不记为 overlap", () => {
    const local = nav(100, [
      { id: "c1", name: "C1", sort: 1, sites: [site("a", { updatedAt: undefined })] },
    ]);
    const remote = nav(200, [
      { id: "c1", name: "C1", sort: 1, sites: [site("a", { title: "site-a", url: "https://example.com/a" })] },
    ]);

    const { merged, overlaps } = mergeNavData(local, remote);

    expect(overlaps).toHaveLength(0);
    expect(merged.categories[0].sites).toHaveLength(1);
  });
});

describe("mergeNavData 墓碑（删除跨设备传播）", () => {
  const tombstone = (id: string, at = "2026-05-01T00:00:00.000Z") =>
    site(id, { _deleted: true, deletedAt: at });

  it("本地删除站点（墓碑），远端仍存活 → 删除胜出，合并结果含墓碑条目", () => {
    const local = nav(100, [{ id: "c1", name: "C1", sort: 1, sites: [tombstone("a")] }]);
    const remote = nav(200, [{ id: "c1", name: "C1", sort: 1, sites: [site("a")] }]);

    const { merged, overlaps } = mergeNavData(local, remote);

    const a = merged.categories[0].sites.find((s) => s.id === "a")!;
    expect(a._deleted).toBe(true); // 墓碑保留，可被推送远端
    expect(overlaps).toEqual(["c1/a"]);
  });

  it("远端删除站点，本地存活 → 同样删除胜出", () => {
    const local = nav(100, [{ id: "c1", name: "C1", sort: 1, sites: [site("a")] }]);
    const remote = nav(200, [{ id: "c1", name: "C1", sort: 1, sites: [tombstone("a")] }]);

    const { merged } = mergeNavData(local, remote);

    expect(merged.categories[0].sites.find((s) => s.id === "a")!._deleted).toBe(true);
  });

  it("本地删除、远端从未有该站点 → 墓碑随合并保留并推送", () => {
    const local = nav(100, [{ id: "c1", name: "C1", sort: 1, sites: [tombstone("a")] }]);
    const remote = nav(200, [{ id: "c1", name: "C1", sort: 1, sites: [] }]);

    const { merged } = mergeNavData(local, remote);

    const a = merged.categories[0].sites.find((s) => s.id === "a");
    expect(a?._deleted).toBe(true);
  });

  it("本地删除分类（墓碑），远端仍有该分类 → 分类级删除胜出", () => {
    const local = nav(100, [
      { id: "c1", name: "C1", sort: 1, sites: [site("a")], _deleted: true, deletedAt: "2026-05-01T00:00:00.000Z" },
    ]);
    const remote = nav(200, [{ id: "c1", name: "C1", sort: 1, sites: [site("a")] }]);

    const { merged } = mergeNavData(local, remote);

    expect(merged.categories.find((c) => c.id === "c1")!._deleted).toBe(true);
  });

  it("删除与编辑冲突 → 墓碑胜出（不被后来的编辑覆盖）", () => {
    const local = nav(100, [{ id: "c1", name: "C1", sort: 1, sites: [tombstone("a", "2026-05-01T00:00:00.000Z")] }]);
    const remote = nav(300, [
      { id: "c1", name: "C1", sort: 1, sites: [site("a", { title: "remote-edit", updatedAt: "2026-06-01T00:00:00.000Z" })] },
    ]);

    const { merged, overlaps } = mergeNavData(local, remote);

    const a = merged.categories[0].sites.find((s) => s.id === "a")!;
    expect(a._deleted).toBe(true); // 删除不被编辑覆盖
    expect(overlaps).toEqual(["c1/a"]);
  });
});
