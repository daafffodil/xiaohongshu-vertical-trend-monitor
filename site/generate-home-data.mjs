import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const defaultProject = resolve(here, "..");

function normalize(markdown) {
  return markdown.replace(/\r\n?/g, "\n");
}

function cleanInline(value = "") {
  return value
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cellInfo(value = "") {
  const match = /\[([^\]]+)\]\(([^)]+)\)/.exec(value);
  return {
    text: cleanInline(value),
    title: cleanInline(match ? match[1] : value),
    source: match ? match[2] : null,
  };
}

function headingBody(markdown, heading) {
  const lines = normalize(markdown).split("\n");
  const targetIndex = lines.findIndex((line) => line.trim() === heading);
  if (targetIndex < 0) return [];

  const level = /^(#{1,6})\s/.exec(heading)?.[1].length || 6;
  let end = lines.length;
  for (let index = targetIndex + 1; index < lines.length; index += 1) {
    const nextHeading = /^(#{1,6})\s/.exec(lines[index]);
    if (nextHeading && nextHeading[1].length <= level) {
      end = index;
      break;
    }
  }
  return lines.slice(targetIndex + 1, end);
}

function parseTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableDivider(line = "") {
  return /^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim());
}

function tableAfterHeading(markdown, heading) {
  const lines = headingBody(markdown, heading);
  const headerIndex = lines.findIndex(
    (line, index) => line.trim().startsWith("|") && isTableDivider(lines[index + 1]),
  );
  if (headerIndex < 0) return [];

  const headers = parseTableRow(lines[headerIndex]);
  const rows = [];
  for (let index = headerIndex + 2; index < lines.length; index += 1) {
    if (!lines[index].trim().startsWith("|")) break;
    const cells = parseTableRow(lines[index]);
    rows.push(
      Object.fromEntries(headers.map((header, cellIndex) => [cleanInline(header), cells[cellIndex] || ""])),
    );
  }
  return rows;
}

function listAfterHeading(markdown, heading, ordered = false) {
  const lines = headingBody(markdown, heading);
  const expression = ordered ? /^\d+\.\s+(.+)$/ : /^[-*]\s+(.+)$/;
  return lines
    .map((line) => expression.exec(line.trim())?.[1])
    .filter(Boolean)
    .map(cleanInline);
}

function detailedListAfterHeading(markdown, heading, ordered = false) {
  const lines = headingBody(markdown, heading);
  const expression = ordered ? /^\d+\.\s+(.+)$/ : /^[-*]\s+(.+)$/;
  return lines
    .map((line) => expression.exec(line.trim())?.[1])
    .filter(Boolean)
    .map((raw) => {
      const boldLead = /^\*\*([^*]+)\*\*\s*(.*)$/.exec(raw);
      if (boldLead) {
        return {
          headline: cleanInline(boldLead[1]).replace(/[。！？!?]+$/, ""),
          detail: cleanInline(boldLead[2]),
        };
      }

      const plain = cleanInline(raw);
      const firstSentence = /^(.+?[。！？!?])(?:\s*(.*))?$/.exec(plain);
      return {
        headline: (firstSentence?.[1] || plain).replace(/[。！？!?]+$/, ""),
        detail: firstSentence?.[2] || "",
      };
    });
}

function getCell(row, names) {
  for (const name of names) {
    if (Object.hasOwn(row, name)) return row[name];
  }
  return "";
}

function toDateOnly(referenceDate, rawValue = "") {
  const raw = cleanInline(rawValue);
  if (!raw) return "";

  const explicitChinese = /(\d{1,2})\s*月\s*(\d{1,2})\s*日/.exec(raw);
  if (explicitChinese) return `${Number(explicitChinese[1])}月${Number(explicitChinese[2])}日`;

  const explicitIso = /(?:\d{4}-)?(\d{2})-(\d{2})/.exec(raw);
  if (explicitIso) return `${Number(explicitIso[1])}月${Number(explicitIso[2])}日`;

  const reference = new Date(`${referenceDate}T12:00:00+08:00`);
  if (Number.isNaN(reference.valueOf())) return "";

  let offset = 0;
  if (/昨日/.test(raw)) offset = -1;
  const daysAgo = /(\d+)\s*天前/.exec(raw);
  if (daysAgo) offset = -Number(daysAgo[1]);

  const date = new Date(reference);
  date.setUTCDate(date.getUTCDate() + offset);
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return month && day ? `${Number(month)}月${Number(day)}日` : "";
}

function searchUrl(title, source) {
  if (!source || !title) return null;
  const url = new URL("https://www.xiaohongshu.com/search_result");
  url.searchParams.set("keyword", title);
  url.searchParams.set("source", "web_search_result_notes");
  url.searchParams.set("type", "51");
  return url.toString();
}

function classify(topic = "", title = "", type = "", fallback = "") {
  const source = `${topic} ${title} ${type}`;
  const tags = [];

  if (/旧衣|闲置衣|衣物|衣柜|穿着|连衣裙|羊毛大衣|改造|回收|转赠|包包/.test(source)) {
    tags.push("old-clothes");
  }
  if (/断舍离|告别|扔|清空|大扫除|整理|杂物|收藏夹|留念|持有成本/.test(source)) {
    tags.push("declutter");
  }
  if (/极简|低物欲|低消费|少买|不购买|消费|八平米|简单生活|不花钱/.test(source)) {
    tags.push("minimal");
  }
  if (/女性|主体性|年龄|关系|倾听|优绩主义|成长|PMS|王虹|职场|AI转型|女生/.test(source)) {
    tags.push("women");
  }
  if (!tags.length) tags.push("other");

  let primary = fallback;
  if (/女性|主体性|年龄|关系|倾听|优绩主义|成长|PMS|王虹|职场|AI转型|女生/.test(source)) {
    primary = "女性成长";
  } else if (/旧衣|闲置衣|衣物|衣柜|连衣裙|羊毛大衣|改造|回收|转赠|包包/.test(source)) {
    primary = "旧衣";
  } else if (/极简|低物欲|低消费|少买|不购买|消费|八平米|简单生活|不花钱/.test(source)) {
    primary = "极简";
  } else if (/断舍离|告别|扔|清空|大扫除|整理|杂物|收藏夹|留念|持有成本/.test(source)) {
    primary = "断舍离";
  }

  return { primary: primary || "观察", tags: [...new Set(tags)] };
}

const coverByTitle = new Map([
  ["断舍离02｜这次居然翻到了我们的青春", "./assets/memory.webp"],
  ["我清空购物车的方式就是删除", "./assets/cart-delete.webp"],
  ["说一说极简后不会再买的东西！！", "./assets/minimal-buy.webp"],
  ["主体性一下就回来了", "./assets/agency.webp"],
]);

function rowToCard(row, referenceDate, kind = "content") {
  const content = cellInfo(
    getCell(row, ["内容", "选题方向", "选题"]),
  );
  const topic = cleanInline(
    getCell(row, ["主题簇", "主题", "类型"]),
  );
  const type = cleanInline(getCell(row, ["类型"]));
  const classification = classify(topic, content.title, type);
  const dateSource = getCell(row, ["发布时间", "页面时间", "时间"]);
  const metrics = cleanInline(
    getCell(row, [
      "采样时可见互动",
      "定稿时可见互动",
      "当前可见互动",
      "定稿时互动",
      "当前互动",
      "可见互动",
      "点赞",
    ]),
  );
  const change = cleanInline(
    getCell(row, ["已知增量", "已知变化", "本轮增量", "增量"]),
  );
  const insight = cleanInline(
    getCell(row, [
      "当前判断",
      "判断",
      "周级判断",
      "月度价值",
      "研究价值",
      "复核状态",
      "状态",
      "建议的解决路径",
    ]),
  );
  const hasLatestPair = Object.hasOwn(row, "07-30 值");
  const hasPreviousPair =
    Object.hasOwn(row, "07-28 基线") || Object.hasOwn(row, "07-28 值");
  const baseline = hasLatestPair
    ? cleanInline(row["07-29 值"])
    : hasPreviousPair
      ? cleanInline(row["07-28 基线"] || row["07-28 值"])
      : cleanInline(row["基线"]);
  const current = hasLatestPair
    ? cleanInline(row["07-30 值"])
    : hasPreviousPair
      ? cleanInline(row["07-29 值"])
      : cleanInline(row["定稿值"]);
  const reviewedInsight =
    content.title === "他们只说你矫情……但没人说 90% 女生在经历 PMS"
      ? `跨月历史信号，发布日期待补核${insight ? `；${insight}` : ""}`
      : insight;

  return {
    kind,
    title: content.title,
    href: searchUrl(content.title, content.source),
    topic: classification.primary,
    tags: classification.tags,
    type,
    author: cleanInline(getCell(row, ["作者"])),
    date: toDateOnly(referenceDate, dateSource),
    metrics,
    change,
    baseline,
    current,
    insight: reviewedInsight,
    priority: cleanInline(getCell(row, ["优先级"])),
    evidence: cleanInline(getCell(row, ["当日依据", "证据"])),
    confidence: cleanInline(getCell(row, ["置信度"])),
    image: coverByTitle.get(content.title) || null,
  };
}

function rowsToCards(rows, referenceDate, kind) {
  return rows
    .map((row) => rowToCard(row, referenceDate, kind))
    .filter((card) => card.title);
}

function conclusionCards(items, referenceDate) {
  return items.map(({ headline, detail }) => {
    const classification = classify("", headline, "", "结论");
    return {
      kind: "conclusion",
      title: headline,
      href: null,
      topic: "结论",
      tags: classification.tags,
      type: "",
      author: "",
      date: toDateOnly(referenceDate, referenceDate),
      metrics: "",
      change: "",
      baseline: "",
      current: "",
      insight: "",
      priority: "",
      evidence: "",
      detail: detail || headline,
      confidence: "",
      image: null,
    };
  });
}

function canonicalTitle(title = "") {
  return title
    .normalize("NFKC")
    .toLocaleLowerCase("zh-CN")
    .replace(/[\p{P}\p{S}\s]+/gu, "");
}

function numericValue(text = "", suffix = "赞") {
  const source = String(text).replaceAll(",", "");
  const tenThousands = new RegExp(`([\\d.]+)\\s*万\\s*${suffix}`).exec(source);
  if (tenThousands) return Number(tenThousands[1]) * 10000;
  const direct = new RegExp(`([\\d.]+)\\s*${suffix}`).exec(source);
  return direct ? Number(direct[1]) : 0;
}

function visibleLikeScore(card) {
  return Math.max(
    numericValue(card.metrics),
    numericValue(card.current),
    numericValue(card.baseline),
  );
}

function changeScore(text = "") {
  const likeChange = numericValue(text);
  if (likeChange) return likeChange;
  const generic = /(?:约\s*)?([+-]?)\s*([\d.]+)\s*(万)?/.exec(
    String(text).replaceAll(",", ""),
  );
  if (!generic) return 0;
  const value = Number(generic[2]) * (generic[3] ? 10000 : 1);
  return generic[1] === "-" ? -value : value;
}

function mergeSourceCards({ content = [], review = [], needs = [], increments = [] }) {
  const merged = new Map();
  const sources = [
    ["content", content],
    ["review", review],
    ["needs", needs],
    ["increment", increments],
  ];
  let order = 0;

  for (const [sourceKind, cards] of sources) {
    for (const sourceCard of cards) {
      const key = canonicalTitle(sourceCard.title);
      if (!key) continue;
      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, {
          ...sourceCard,
          sourceKinds: [sourceKind],
          sourceOrder: order,
        });
        order += 1;
        continue;
      }

      if (!existing.sourceKinds.includes(sourceKind)) {
        existing.sourceKinds.push(sourceKind);
      }
      for (const field of ["baseline", "current", "change"]) {
        if (!existing[field] && sourceCard[field]) existing[field] = sourceCard[field];
      }
      if (!existing.metrics && sourceCard.metrics) existing.metrics = sourceCard.metrics;
      if (!existing.author && sourceCard.author) existing.author = sourceCard.author;
      if (!existing.date && sourceCard.date) existing.date = sourceCard.date;
      if (!existing.image && sourceCard.image) existing.image = sourceCard.image;
    }
  }

  return [...merged.values()];
}

function publicGroups(sourceGroups, conclusions = [], topics = []) {
  const sources = mergeSourceCards(sourceGroups);
  const highlights = [];
  const inspiration = [];

  for (const card of sources) {
    const forceInspiration =
      card.sourceKinds.includes("review") || card.sourceKinds.includes("needs");
    const incrementOnly =
      card.sourceKinds.length === 1 && card.sourceKinds.includes("increment");
    const hasPositiveLikeChange = changeScore(card.change) > 0;
    const highLiked =
      !forceInspiration &&
      visibleLikeScore(card) >= 100 &&
      (!incrementOnly || hasPositiveLikeChange);
    const target = highLiked ? highlights : inspiration;
    target.push({
      ...card,
      section: highLiked ? "highlights" : "inspiration",
    });
  }

  highlights.sort(
    (left, right) =>
      visibleLikeScore(right) - visibleLikeScore(left) ||
      left.sourceOrder - right.sourceOrder,
  );
  inspiration.sort((left, right) => left.sourceOrder - right.sourceOrder);

  const publicConclusions = conclusions.map((card) => ({
    ...card,
    section: "conclusions",
  }));
  const publicTopics = topics.map((card) => ({
    ...card,
    section: "topics",
  }));

  return {
    all: [...highlights, ...inspiration, ...publicConclusions, ...publicTopics],
    highlights,
    inspiration,
    conclusions: publicConclusions,
    topics: publicTopics,
  };
}

function splitArchiveDays(markdown) {
  const source = normalize(markdown);
  const matches = [...source.matchAll(/^## (\d{4}-\d{2}-\d{2})\s*$/gm)];
  return matches.map((match, index) => ({
    date: match[1],
    markdown: source.slice(
      match.index,
      matches[index + 1]?.index ?? source.length,
    ),
  }));
}

function displayDate(isoDate) {
  const [, month, day] = isoDate.split("-").map(Number);
  return `${month}月${day}日`;
}

function buildArchiveDay(day) {
  const content = rowsToCards(
    tableAfterHeading(day.markdown, "### 内容信号榜"),
    day.date,
    "content",
  );
  const review = rowsToCards(
    tableAfterHeading(day.markdown, "### 待复核信号"),
    day.date,
    "review",
  );
  const needs = rowsToCards(
    tableAfterHeading(day.markdown, "### 需求／交易／品牌信号"),
    day.date,
    "needs",
  );
  const increments = rowsToCards(
    tableAfterHeading(day.markdown, "### 同帖互动增量"),
    day.date,
    "increment",
  );
  const conclusions = conclusionCards(
    detailedListAfterHeading(day.markdown, "### 当日结论", true),
    day.date,
  );
  const topics = rowsToCards(
    tableAfterHeading(day.markdown, "### 当日选题方向"),
    day.date,
    "topic",
  );

  const groups = publicGroups(
    { content, review, needs, increments },
    conclusions,
    topics,
  );
  const counts = Object.fromEntries(
    Object.entries(groups).map(([key, cards]) => [key, cards.length]),
  );

  return {
    date: day.date,
    label: displayDate(day.date),
    counts,
    groups,
    exclusions: listAfterHeading(day.markdown, "### 排除项"),
    gaps: listAfterHeading(day.markdown, "### 数据缺口"),
  };
}

export async function generateHomeData(project = defaultProject) {
  const [report, archive] = await Promise.all([
    readFile(resolve(project, "report.md"), "utf8"),
    readFile(resolve(project, "archive.md"), "utf8"),
  ]);

  const updated =
    /^- 更新日期：(\d{4}-\d{2}-\d{2})$/m.exec(report)?.[1] ||
    /^## (\d{4}-\d{2}-\d{2})$/m.exec(archive)?.[1] ||
    "";

  const archiveSources = splitArchiveDays(archive);
  const archiveDays = archiveSources.map(buildArchiveDay);
  const currentArchiveSource = archiveSources.find((day) => day.date === updated);

  const dayContent = rowsToCards(
    tableAfterHeading(report, "## 24 小时内容信号榜"),
    updated,
    "content",
  );
  const dayReview = rowsToCards(
    tableAfterHeading(report, "### 24 小时待复核信号"),
    updated,
    "review",
  );
  const dayNeeds = rowsToCards(
    tableAfterHeading(
      currentArchiveSource?.markdown || "",
      "### 需求／交易／品牌信号",
    ),
    updated,
    "needs",
  );
  const dayIncrements = rowsToCards(
    tableAfterHeading(
      currentArchiveSource?.markdown || "",
      "### 同帖互动增量",
    ),
    updated,
    "increment",
  );
  const dayConclusions = conclusionCards(
    detailedListAfterHeading(report, "## 最新结论", true),
    updated,
  );
  const dayTopics = rowsToCards(
    tableAfterHeading(
      currentArchiveSource?.markdown || "",
      "### 当日选题方向",
    ),
    updated,
    "topic",
  );

  const weekContent = rowsToCards(
    tableAfterHeading(report, "### 本周内容型"),
    updated,
    "content",
  );
  const weekNeeds = rowsToCards(
    tableAfterHeading(report, "### 本周需求／交易／品牌型"),
    updated,
    "needs",
  );
  const monthContent = rowsToCards(
    tableAfterHeading(report, "### 本月内容型"),
    updated,
    "content",
  );
  const monthNeeds = rowsToCards(
    tableAfterHeading(report, "### 本月需求／交易／品牌型"),
    updated,
    "needs",
  );

  const periods = {
    day: {
      label: "24小时",
      groups: publicGroups(
        {
          content: dayContent,
          review: dayReview,
          needs: dayNeeds,
          increments: dayIncrements,
        },
        dayConclusions,
        dayTopics,
      ),
    },
    week: {
      label: "本周",
      groups: publicGroups({ content: weekContent, needs: weekNeeds }),
    },
    month: {
      label: "本月",
      groups: publicGroups({ content: monthContent, needs: monthNeeds }),
    },
  };

  const payload = {
    updated,
    updatedLabel: displayDate(updated),
    filters: [
      { id: "all", label: "全部" },
      { id: "old-clothes", label: "旧衣" },
      { id: "declutter", label: "断舍离" },
      { id: "minimal", label: "极简" },
      { id: "women", label: "女性成长" },
    ],
    groupLabels: {
      all: "全部",
      highlights: "高赞",
      inspiration: "灵感",
      conclusions: "结论",
      topics: "选题",
    },
    periods,
    archive: archiveDays.filter((day) => day.date !== updated),
  };

  await writeFile(
    resolve(project, "site-data.js"),
    `window.TREND_DATA = ${JSON.stringify(payload, null, 2)};\n`,
    "utf8",
  );
  return payload;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const data = await generateHomeData();
  console.log(
    `Generated home data for ${data.updated}: ${data.periods.day.groups.all.length} current items, ${data.archive.length} archived days`,
  );
}
