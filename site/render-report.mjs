import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const defaultProject = resolve(here, "..");

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderInline(value) {
  const code = [];
  let source = value.replace(/`([^`]+)`/g, (_, content) => {
    const index = code.push(`<code>${escapeHtml(content)}</code>`) - 1;
    return `\u0000CODE${index}\u0000`;
  });

  source = escapeHtml(source);
  source = source.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
    const decodedHref = href.replaceAll("&amp;", "&");
    const allowed =
      decodedHref.startsWith("https://") ||
      decodedHref.startsWith("http://") ||
      decodedHref.startsWith("./") ||
      decodedHref.startsWith("#");
    const target = allowed ? escapeHtml(decodedHref) : "#";
    const external = /^https?:\/\//.test(decodedHref);
    return `<a href="${target}"${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>${label}</a>`;
  });
  source = source.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  source = source.replace(/\u0000CODE(\d+)\u0000/g, (_, index) => code[Number(index)]);
  return source;
}

function plainText(value) {
  return value
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

function createSlugger() {
  const counts = new Map();
  return (value) => {
    const base =
      plainText(value)
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s-]/gu, "")
        .trim()
        .replace(/\s+/g, "-") || "section";
    const count = counts.get(base) || 0;
    counts.set(base, count + 1);
    return count === 0 ? base : `${base}-${count + 1}`;
  };
}

function isTableSeparator(line) {
  return /^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim());
}

function parseTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function startsBlock(line, nextLine = "") {
  return (
    line.trim() === "" ||
    /^#{1,6}\s+/.test(line) ||
    /^>\s?/.test(line) ||
    /^[-*]\s+/.test(line) ||
    /^\d+\.\s+/.test(line) ||
    /^```/.test(line) ||
    /^---+$/.test(line.trim()) ||
    (line.trim().startsWith("|") && isTableSeparator(nextLine))
  );
}

function renderMarkdown(markdown) {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const slug = createSlugger();
  const output = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (/^```/.test(trimmed)) {
      const language = trimmed.slice(3).trim();
      const code = [];
      index += 1;
      while (index < lines.length && !/^```/.test(lines[index].trim())) {
        code.push(lines[index]);
        index += 1;
      }
      index += 1;
      output.push(
        `<pre><code${language ? ` class="language-${escapeHtml(language)}"` : ""}>${escapeHtml(code.join("\n"))}</code></pre>`,
      );
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2].trim();
      output.push(
        `<h${level} id="${slug(text)}">${renderInline(text)}</h${level}>`,
      );
      index += 1;
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      output.push("<hr>");
      index += 1;
      continue;
    }

    if (trimmed.startsWith("|") && isTableSeparator(lines[index + 1] || "")) {
      const headers = parseTableRow(line);
      const rows = [];
      index += 2;
      while (index < lines.length && lines[index].trim().startsWith("|")) {
        rows.push(parseTableRow(lines[index]));
        index += 1;
      }
      const head = headers
        .map((cell) => `<th scope="col">${renderInline(cell)}</th>`)
        .join("");
      const body = rows
        .map(
          (row) =>
            `<tr>${headers
              .map(
                (_, cellIndex) =>
                  `<td>${renderInline(row[cellIndex] || "")}</td>`,
              )
              .join("")}</tr>`,
        )
        .join("");
      output.push(
        `<div class="table-scroll"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`,
      );
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quote.push(lines[index].replace(/^>\s?/, ""));
        index += 1;
      }
      output.push(`<blockquote>${renderInline(quote.join(" "))}</blockquote>`);
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^[-*]\s+/, ""));
        index += 1;
      }
      output.push(
        `<ul>${items.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ul>`,
      );
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\d+\.\s+/, ""));
        index += 1;
      }
      output.push(
        `<ol>${items.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ol>`,
      );
      continue;
    }

    const paragraph = [trimmed];
    index += 1;
    while (
      index < lines.length &&
      !startsBlock(lines[index], lines[index + 1] || "")
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    output.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
  }

  return output.join("\n");
}

function pageTemplate({ title, description, body, sourceFile, alternatePage }) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#ffffff">
  <title>${escapeHtml(title)}｜小红书垂直趋势监控</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="stylesheet" href="./report.css">
</head>
<body>
  <header class="report-top">
    <a class="report-brand" href="./">
      <img src="https://daafffodil.github.io/dangdang-textile-daily/brand-mark.png" alt="">
      <span>小红书垂直趋势监控</span>
    </a>
    <nav aria-label="报告导航">
      <a class="directory-link" href="https://daafffodil.github.io/dangdang-textile-daily/">返回项目目录</a>
      <a href="${alternatePage.href}">${alternatePage.label}</a>
      <a href="./${sourceFile}">Markdown 源文件</a>
    </nav>
  </header>
  <main class="markdown-body">
${body}
  </main>
</body>
</html>
`;
}

export async function renderReportPages(project = defaultProject) {
  const pages = [
    {
      source: "report.md",
      output: "report.html",
      title: "小红书垂直主题趋势总报",
      description: "旧衣、断舍离、极简与女性成长的24小时、本周和本月趋势报告。",
      alternatePage: { href: "./archive.html", label: "历史日榜" },
    },
    {
      source: "archive.md",
      output: "archive.html",
      title: "小红书24小时日榜归档",
      description: "按日期倒序保留的小红书垂直主题24小时正式日榜。",
      alternatePage: { href: "./report.html", label: "当前报告" },
    },
  ];

  for (const page of pages) {
    const markdown = await readFile(resolve(project, page.source), "utf8");
    const html = pageTemplate({
      title: page.title,
      description: page.description,
      body: renderMarkdown(markdown),
      sourceFile: page.source,
      alternatePage: page.alternatePage,
    });
    await writeFile(resolve(project, page.output), html, "utf8");
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  await renderReportPages();
  console.log("Rendered Markdown report pages");
}

