import { createClient } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^TURSO_(DATABASE_URL|AUTH_TOKEN)=(.+)$/);
    if (m) process.env[`TURSO_${m[1]}`] = m[2].trim();
  }
}
const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});
await db.batch([
  "DROP TABLE IF EXISTS sites",
  "DROP TABLE IF EXISTS categories",
  "DROP TABLE IF EXISTS nav_meta",
]);
console.log("旧表已删除（sites/categories/nav_meta），数据清空完成");
