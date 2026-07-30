import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderReportPages } from "./render-report.mjs";

const project = resolve(fileURLToPath(new URL("..", import.meta.url)));
const [reportSource, archiveSource] = process.argv.slice(2);

if (!reportSource || !archiveSource) {
  throw new Error(
    "Usage: node site/sync-report.mjs <trend-report.md> <daily-archive.md>",
  );
}

function sanitizeForPublic(markdown, isReport) {
  let result = markdown.replace(
    /https:\/\/www\.xiaohongshu\.com\/search_result\/([a-z0-9]+)\?[^)\s]+/gi,
    "https://www.xiaohongshu.com/explore/$1",
  );
  result = result.replace(
    /https:\/\/www\.xiaohongshu\.com\/search_result\/([a-z0-9]+)/gi,
    "https://www.xiaohongshu.com/explore/$1",
  );
  if (isReport) {
    result = result.replace(
      "./XIAOHONGSHU_24H_DAILY_ARCHIVE.md",
      "./archive.html",
    );
  }
  return result;
}

const report = sanitizeForPublic(await readFile(resolve(reportSource), "utf8"), true);
const archive = sanitizeForPublic(
  await readFile(resolve(archiveSource), "utf8"),
  false,
);

await writeFile(resolve(project, "report.md"), report, "utf8");
await writeFile(resolve(project, "archive.md"), archive, "utf8");
await renderReportPages(project);

console.log("Synced sanitized Markdown report and archive");
