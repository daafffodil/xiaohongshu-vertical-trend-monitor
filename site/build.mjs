import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generateHomeData } from "./generate-home-data.mjs";
import { renderReportPages } from "./render-report.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const project = resolve(here, "..");
const dist = join(project, "dist");
await generateHomeData(project);
await renderReportPages(project);
const html = await readFile(join(project, "index.html"), "utf8");
const css = await readFile(join(project, "styles.css"), "utf8");
const script = await readFile(join(project, "app.js"), "utf8");
const siteData = await readFile(join(project, "site-data.js"), "utf8");
const reportHtml = await readFile(join(project, "report.html"), "utf8");
const archiveHtml = await readFile(join(project, "archive.html"), "utf8");
const reportMarkdown = await readFile(join(project, "report.md"), "utf8");
const archiveMarkdown = await readFile(join(project, "archive.md"), "utf8");
const reportCss = await readFile(join(project, "report.css"), "utf8");
const assetNames = [
  "memory.webp",
  "minimal-buy.webp",
  "agency.webp",
  "cart-delete.webp",
];
const assetBuffers = Object.fromEntries(
  await Promise.all(
    assetNames.map(async (name) => [
      name,
      await readFile(join(project, "assets", name)),
    ]),
  ),
);
const hosting = JSON.parse(
  await readFile(join(project, ".openai", "hosting.json"), "utf8"),
);

if (!dist.startsWith(project)) {
  throw new Error("Refusing to build outside the project");
}

await rm(dist, { recursive: true, force: true });
await mkdir(join(dist, "server"), { recursive: true });
await mkdir(join(dist, "client"), { recursive: true });
await mkdir(join(dist, "client", "assets"), { recursive: true });
await mkdir(join(dist, ".openai"), { recursive: true });

await writeFile(join(dist, "client", "index.html"), html, "utf8");
await writeFile(join(dist, "client", "styles.css"), css, "utf8");
await writeFile(join(dist, "client", "app.js"), script, "utf8");
await writeFile(join(dist, "client", "site-data.js"), siteData, "utf8");
await writeFile(join(dist, "client", "report.html"), reportHtml, "utf8");
await writeFile(join(dist, "client", "archive.html"), archiveHtml, "utf8");
await writeFile(join(dist, "client", "report.md"), reportMarkdown, "utf8");
await writeFile(join(dist, "client", "archive.md"), archiveMarkdown, "utf8");
await writeFile(join(dist, "client", "report.css"), reportCss, "utf8");
await Promise.all(
  Object.entries(assetBuffers).map(([name, buffer]) =>
    writeFile(join(dist, "client", "assets", name), buffer),
  ),
);
await writeFile(
  join(dist, "server", "index.js"),
  `const html=${JSON.stringify(html)};\nconst css=${JSON.stringify(css)};\nconst script=${JSON.stringify(script)};\nconst siteData=${JSON.stringify(siteData)};\nconst reportHtml=${JSON.stringify(reportHtml)};\nconst archiveHtml=${JSON.stringify(archiveHtml)};\nconst reportMarkdown=${JSON.stringify(reportMarkdown)};\nconst archiveMarkdown=${JSON.stringify(archiveMarkdown)};\nconst reportCss=${JSON.stringify(reportCss)};\nconst assets=${JSON.stringify(Object.fromEntries(Object.entries(assetBuffers).map(([name,buffer])=>[name,buffer.toString("base64")])))};\nconst secure={"cache-control":"public, max-age=300","x-content-type-options":"nosniff"};\nfunction decodeBase64(value){const binary=atob(value);return Uint8Array.from(binary,(char)=>char.charCodeAt(0));}\nexport default {async fetch(request){const url=new URL(request.url);const path=url.pathname.replace(/\\/+$/,"")||"/";if(path==="/health")return new Response("ok");if(path.endsWith("/styles.css"))return new Response(css,{headers:{...secure,"content-type":"text/css; charset=utf-8"}});if(path.endsWith("/app.js"))return new Response(script,{headers:{...secure,"content-type":"text/javascript; charset=utf-8"}});if(path.endsWith("/site-data.js"))return new Response(siteData,{headers:{...secure,"content-type":"text/javascript; charset=utf-8"}});if(path.includes("/assets/")){const name=path.split("/").pop();if(assets[name])return new Response(decodeBase64(assets[name]),{headers:{...secure,"content-type":"image/webp"}});}if(path.endsWith("/report.css"))return new Response(reportCss,{headers:{...secure,"content-type":"text/css; charset=utf-8"}});if(path.endsWith("/report.md"))return new Response(reportMarkdown,{headers:{...secure,"content-type":"text/markdown; charset=utf-8"}});if(path.endsWith("/archive.md"))return new Response(archiveMarkdown,{headers:{...secure,"content-type":"text/markdown; charset=utf-8"}});if(path.endsWith("/report")||path.endsWith("/report.html"))return new Response(reportHtml,{headers:{...secure,"content-type":"text/html; charset=utf-8"}});if(path.endsWith("/archive")||path.endsWith("/archive.html"))return new Response(archiveHtml,{headers:{...secure,"content-type":"text/html; charset=utf-8"}});return new Response(html,{headers:{...secure,"content-type":"text/html; charset=utf-8"}})}};\n`,
  "utf8",
);
await writeFile(
  join(dist, ".openai", "hosting.json"),
  JSON.stringify(hosting, null, 2),
  "utf8",
);

console.log("Built public site and production worker");
