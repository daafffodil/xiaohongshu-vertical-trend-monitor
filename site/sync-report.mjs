import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generateHomeData } from "./generate-home-data.mjs";
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

async function versionHomepageAssets() {
  const indexPath = resolve(project, "index.html");
  let html = await readFile(indexPath, "utf8");

  for (const asset of ["styles.css", "site-data.js", "app.js"]) {
    const contents = await readFile(resolve(project, asset));
    const version = createHash("sha256")
      .update(contents)
      .digest("hex")
      .slice(0, 12);
    const escapedAsset = asset.replaceAll(".", "\\.");
    const reference = new RegExp(
      `((?:href|src)="\\./${escapedAsset})(?:\\?v=[^"]*)?(")`,
      "g",
    );
    html = html.replace(reference, `$1?v=${version}$2`);
  }

  await writeFile(indexPath, html, "utf8");
}

const report = sanitizeForPublic(await readFile(resolve(reportSource), "utf8"), true);
const archive = sanitizeForPublic(
  await readFile(resolve(archiveSource), "utf8"),
  false,
);

await writeFile(resolve(project, "report.md"), report, "utf8");
await writeFile(resolve(project, "archive.md"), archive, "utf8");
await generateHomeData(project);
await renderReportPages(project);
await versionHomepageAssets();

console.log(
  "Synced sanitized Markdown report, archive, homepage data, and cache versions",
);
