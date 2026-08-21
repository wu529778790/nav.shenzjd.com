/**
 * 分类名展示格式化（2026-08-22）
 *
 * 背景：数据库 categories.name 里硬编码了「01　」「05　」这种数据源序号前缀，
 * 一旦删除某个顶级分类就会出现「04 06」跳号。
 *
 * 解决：展示层不再依赖 name 里的硬编码序号，统一按顶级分类在数组中的下标
 * （即「索引」index）生成两位补零的连续编号，并去掉 name 里的旧前缀。
 *
 * 非顶级分类（parentId 存在）原样返回 name，不参与重编号。
 */

const TOP_PREFIX_RE = /^\d+[\s　]+/;

/** 去掉 name 开头的数据源序号前缀（如「01　」「5 」「12　」） */
export function stripTopPrefix(name: string): string {
  return name.replace(TOP_PREFIX_RE, "").trim();
}

/** 顶级分类显示名：`01　影视／动漫／直播／纪录片`（按顶级数组下标生成） */
export function formatTopCategoryName(name: string, topIndex: number): string {
  const stripped = stripTopPrefix(name);
  const num = String(topIndex + 1).padStart(2, "0");
  return `${num}　${stripped}`;
}
