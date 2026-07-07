/**
 * 数据导入导出工具
 * 支持 JSON、OPML 和浏览器书签格式
 */

import type { NavData, Category } from "@/lib/storage/local-storage";
import { visibleCategories } from "@/lib/utils/tombstone";

/**
 * 导出为 JSON 格式
 */
export function exportToJSON(data: NavData): string {
  // 导出备份时剥离墓碑，保留干净数据
  return JSON.stringify({ ...data, categories: visibleCategories(data.categories) }, null, 2);
}

/**
 * 从 JSON 导入
 */
export function importFromJSON(jsonString: string): NavData {
  try {
    const data = JSON.parse(jsonString) as NavData;

    // 验证数据结构
    if (!data.categories || !Array.isArray(data.categories)) {
      throw new Error("无效的数据格式：缺少 categories 数组");
    }

    // 验证并清理数据
    const categories: Category[] = data.categories.map((cat) => ({
      id: cat.id || `cat_${Date.now()}_${Math.random()}`,
      name: cat.name || "未命名分类",
      icon: cat.icon,
      sort: cat.sort ?? 0,
      sites: (cat.sites || []).map((site) => ({
        id: site.id || `site_${Date.now()}_${Math.random()}`,
        title: site.title || "未命名站点",
        url: site.url || "",
        favicon: site.favicon || "",
        description: site.description,
        sort: site.sort,
        createdAt: site.createdAt,
        updatedAt: site.updatedAt,
      })),
    }));

    return {
      version: data.version || "1.0",
      lastModified: data.lastModified || Date.now(),
      categories,
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("JSON 格式错误");
    }
    throw error;
  }
}

/**
 * 导出为 OPML 格式（RSS 订阅格式）
 */
export function exportToOPML(data: NavData): string {
  const xmlHeader =
    '<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0">\n<head>\n<title>NavHub Export</title>\n</head>\n<body>\n';
  const xmlFooter = "</body>\n</opml>";

  const outlines = visibleCategories(data.categories)
    .map((category) => {
      const categoryOutline = `<outline text="${escapeXml(category.name)}" title="${escapeXml(category.name)}">\n`;
      const siteOutlines = category.sites
        .map(
          (site) =>
            `  <outline text="${escapeXml(site.title)}" title="${escapeXml(site.title)}" type="link" xmlUrl="${escapeXml(site.url)}" htmlUrl="${escapeXml(site.url)}"/>\n`
        )
        .join("");
      return categoryOutline + siteOutlines + "</outline>\n";
    })
    .join("");

  return xmlHeader + outlines + xmlFooter;
}

/**
 * 从浏览器书签 HTML 导入
 */
export function importFromBookmarks(htmlString: string): NavData {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, "text/html");
  const bookmarks = doc.querySelectorAll("a");

  const categories: Category[] = [];
  const defaultCategory: Category = {
    id: "imported",
    name: "导入的书签",
    sort: 0,
    sites: [],
  };

  bookmarks.forEach((bookmark, index) => {
    const href = bookmark.getAttribute("href");
    const title = bookmark.textContent || bookmark.getAttribute("title") || "未命名";

    if (href && (href.startsWith("http://") || href.startsWith("https://"))) {
      defaultCategory.sites.push({
        id: `imported_${Date.now()}_${index}`,
        title: title.trim(),
        url: href,
        favicon: `https://www.google.com/s2/favicons?domain=${new URL(href).hostname}&sz=64`,
        sort: index,
      });
    }
  });

  if (defaultCategory.sites.length > 0) {
    categories.push(defaultCategory);
  }

  return {
    version: "1.0",
    lastModified: Date.now(),
    categories,
  };
}

/**
 * 转义 XML 特殊字符
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * 下载文件
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 读取文件内容
 */
export function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        resolve(e.target.result as string);
      } else {
        reject(new Error("读取文件失败"));
      }
    };
    reader.onerror = () => reject(new Error("读取文件时发生错误"));
    reader.readAsText(file);
  });
}
