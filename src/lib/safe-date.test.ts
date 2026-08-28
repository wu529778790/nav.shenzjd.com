import { describe, expect, it } from "vitest";
import { safeDate } from "./safe-date";

describe("safeDate", () => {
  it("解析毫秒时间戳字符串（Turso updated_at 实际存储格式）", () => {
    expect(safeDate("1787854250218").toISOString()).toBe("2026-08-27T18:10:50.218Z");
  });

  it("解析数字时间戳", () => {
    expect(safeDate(1787854250218).toISOString()).toBe("2026-08-27T18:10:50.218Z");
  });

  it("解析 ISO 日期字符串", () => {
    expect(safeDate("2026-08-27T18:10:50.218Z").toISOString()).toBe("2026-08-27T18:10:50.218Z");
  });

  it("对无法解析的字符串回退到当前时间", () => {
    expect(Number.isNaN(safeDate("not-a-date").getTime())).toBe(false);
  });

  it("对空值回退到当前时间", () => {
    expect(Number.isNaN(safeDate(undefined).getTime())).toBe(false);
    expect(Number.isNaN(safeDate(null).getTime())).toBe(false);
    expect(Number.isNaN(safeDate("").getTime())).toBe(false);
  });
});
