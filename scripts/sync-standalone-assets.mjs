/**
 * Next.js `output: "standalone"` traces server code into `.next/standalone` but does not
 * copy `.next/static` or `public`. Serving without this step yields HTML that references
 * chunk URLs which404 on the origin (and in the browser).
 *
 * @see https://nextjs.org/docs/app/api-reference/config/next-config-js/output
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const standaloneRoot = path.join(root, ".next", "standalone");

if (!fs.existsSync(standaloneRoot)) {
  console.log("[sync-standalone] No .next/standalone — skip (not a standalone build).");
  process.exit(0);
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.error("[sync-standalone] Missing source:", src);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true, force: true });
  console.log("[sync-standalone]", path.relative(root, src), "→", path.relative(root, dest));
}

/** @param {string} dir */
function countFilesRecursive(dir) {
  if (!fs.existsSync(dir)) return -1;
  let n = 0;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) n += countFilesRecursive(p);
    else n += 1;
  }
  return n;
}

const standaloneNext = path.join(standaloneRoot, ".next");
fs.mkdirSync(standaloneNext, { recursive: true });
const staticSrc = path.join(root, ".next", "static");
const staticDest = path.join(standaloneNext, "static");
copyDir(staticSrc, staticDest);
// public/ 可能不存在（空目录不被 git 跟踪，CI checkout 后目录缺失）——存在才拷贝
const publicSrc = path.join(root, "public");
if (fs.existsSync(publicSrc)) {
  copyDir(publicSrc, path.join(standaloneRoot, "public"));
} else {
  console.log("[sync-standalone] No public/ directory — skip.");
}

const srcCount = countFilesRecursive(staticSrc);
const destCount = countFilesRecursive(staticDest);
if (srcCount < 1 || destCount !== srcCount) {
  console.error("[sync-standalone] Static copy verification failed:", {
    ".next/static files": srcCount,
    "standalone/.next/static files": destCount,
  });
  console.error(
    "[sync-standalone] Fix: run a clean `npm run build`; deploy the entire `.next/standalone` output."
  );
  process.exit(1);
}
