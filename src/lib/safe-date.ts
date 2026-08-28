/**
 * 把数据库返回的时间字段安全转为 Date，无法解析时回退到当前时间。
 * Turso 的 updated_at 存的是毫秒时间戳字符串（如 "1787854250218"），
 * 直接 new Date(s) 会把纯数字串当年份解析出 Invalid Date，必须先转 Number。
 */
export function safeDate(value: string | number | undefined | null): Date {
  if (value == null || value === "") return new Date();
  const date =
    typeof value === "number" || /^\d+$/.test(value) ? new Date(Number(value)) : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}
