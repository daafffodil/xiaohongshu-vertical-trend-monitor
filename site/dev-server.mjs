import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const project = resolve(here, "..");
const port = Number(process.env.PORT || 4173);

const types = {
  ".html": "text/html; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url || "/", "http://localhost").pathname;
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const candidate = resolve(project, relative);
  if (!candidate.startsWith(project)) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  try {
    const body = await readFile(candidate);
    response.writeHead(200, {
      "content-type": types[extname(candidate)] || "application/octet-stream",
    });
    response.end(body);
  } catch {
    const body = await readFile(resolve(project, "index.html"));
    response.writeHead(200, { "content-type": types[".html"] });
    response.end(body);
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Local URL: http://127.0.0.1:${port}`);
});
