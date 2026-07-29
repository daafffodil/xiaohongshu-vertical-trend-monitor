import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const project = resolve(here, "..");
const dist = join(project, "dist");
const html = await readFile(join(project, "index.html"), "utf8");
const css = await readFile(join(project, "styles.css"), "utf8");
const script = await readFile(join(project, "app.js"), "utf8");
const hosting = JSON.parse(
  await readFile(join(project, ".openai", "hosting.json"), "utf8"),
);

if (!dist.startsWith(project)) {
  throw new Error("Refusing to build outside the project");
}

await rm(dist, { recursive: true, force: true });
await mkdir(join(dist, "server"), { recursive: true });
await mkdir(join(dist, "client"), { recursive: true });
await mkdir(join(dist, ".openai"), { recursive: true });

await writeFile(join(dist, "client", "index.html"), html, "utf8");
await writeFile(join(dist, "client", "styles.css"), css, "utf8");
await writeFile(join(dist, "client", "app.js"), script, "utf8");
await writeFile(
  join(dist, "server", "index.js"),
  `const html=${JSON.stringify(html)};\nconst css=${JSON.stringify(css)};\nconst script=${JSON.stringify(script)};\nexport default {async fetch(request){const url=new URL(request.url);if(url.pathname==="/health")return new Response("ok");if(url.pathname.endsWith("/styles.css"))return new Response(css,{headers:{"content-type":"text/css; charset=utf-8"}});if(url.pathname.endsWith("/app.js"))return new Response(script,{headers:{"content-type":"text/javascript; charset=utf-8"}});return new Response(html,{headers:{"content-type":"text/html; charset=utf-8","cache-control":"public, max-age=300","x-content-type-options":"nosniff"}})}};\n`,
  "utf8",
);
await writeFile(
  join(dist, ".openai", "hosting.json"),
  JSON.stringify(hosting, null, 2),
  "utf8",
);

console.log("Built public site and production worker");
