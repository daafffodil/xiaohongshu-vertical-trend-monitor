const data = window.TREND_DATA;

const currentDate = document.getElementById("current-date");
const currentStream = document.getElementById("current-stream");
const resultStatus = document.getElementById("result-status");
const topicFilters = document.getElementById("topic-filters");
const groupTabs = document.getElementById("group-tabs");
const archiveList = document.getElementById("archive-list");
const periodTabs = [...document.querySelectorAll(".period-tab")];

const groupOrder = [
  "all",
  "highlights",
  "inspiration",
  "conclusions",
  "topics",
];

const state = {
  period: "day",
  group: "all",
  filter: "all",
};

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function splitMetric(value = "") {
  return value
    .split(/[、；]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function themeClass(card) {
  if (card.tags.includes("women")) return "theme-women";
  if (card.tags.includes("old-clothes")) return "theme-old-clothes";
  if (card.tags.includes("minimal")) return "theme-minimal";
  if (card.tags.includes("declutter")) return "theme-declutter";
  return "";
}

function renderTitle(card) {
  const title = escapeHtml(card.title);
  if (!card.href) return `<h3 class="card-title">${title}</h3>`;
  return `<h3 class="card-title"><a href="${escapeHtml(card.href)}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">${title}</a></h3>`;
}

function renderMetrics(card) {
  if (
    card.kind === "increment" ||
    (card.sourceKinds?.includes("increment") && (card.baseline || card.current))
  ) {
    const parts = [];
    if (card.baseline) parts.push(`<span>${escapeHtml(card.baseline)}</span>`);
    if (card.current) {
      if (parts.length) parts.push("<span>→</span>");
      parts.push(`<span>${escapeHtml(card.current)}</span>`);
    }
    if (card.change) {
      parts.push(`<span class="card-change">${escapeHtml(card.change)}</span>`);
    }
    return parts.length ? `<div class="card-metrics">${parts.join("")}</div>` : "";
  }

  const parts = splitMetric(card.metrics);
  if (card.change) {
    parts.push(`<span class="card-change">${escapeHtml(card.change)}</span>`);
  }
  if (!parts.length) return "";
  return `<div class="card-metrics">${parts
    .map((part) => (part.startsWith("<span") ? part : `<span>${escapeHtml(part)}</span>`))
    .join("")}</div>`;
}

function renderInsightCard(card, classes) {
  const detailParts = [];
  if (card.kind === "conclusion" && card.detail) {
    detailParts.push(`<p>${escapeHtml(card.detail)}</p>`);
  }
  if (card.kind === "topic" && card.evidence) {
    detailParts.push(
      `<p><strong>依据</strong><span>${escapeHtml(card.evidence)}</span></p>`,
    );
  }
  if (card.kind === "topic" && card.insight) {
    detailParts.push(
      `<p><strong>做法</strong><span>${escapeHtml(card.insight)}</span></p>`,
    );
  }
  if (!detailParts.length) {
    detailParts.push(`<p>${escapeHtml(card.title)}</p>`);
  }

  return `<details class="${classes} insight-card" data-kind="${escapeHtml(card.kind)}" data-tags="${escapeHtml(card.tags.join(" "))}">
    <summary class="insight-summary">
      <span class="card-topic">${escapeHtml(card.topic)}</span>
      <h3 class="card-title">${escapeHtml(card.title)}</h3>
      <span class="insight-toggle" aria-hidden="true"></span>
    </summary>
    <div class="card-detail">${detailParts.join("")}</div>
  </details>`;
}

function renderCard(card) {
  const classes = [
    "card",
    `kind-${card.kind}`,
    themeClass(card),
    card.image ? "has-cover" : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (card.kind === "conclusion" || card.kind === "topic") {
    return renderInsightCard(card, classes);
  }

  const cover = card.image
    ? card.href
      ? `<a class="card-cover" href="${escapeHtml(card.href)}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer" aria-label="在小红书检索 ${escapeHtml(card.title)}"><img src="${escapeHtml(card.image)}" alt="${escapeHtml(card.title)}封面"></a>`
      : `<div class="card-cover"><img src="${escapeHtml(card.image)}" alt="${escapeHtml(card.title)}封面"></div>`
    : "";

  const meta = [card.author, card.date].filter(Boolean);
  const metaMarkup = meta.length
    ? `<p class="card-meta">${meta
        .map((item) => `<span>${escapeHtml(item)}</span>`)
        .join("")}</p>`
    : "";

  const linkStatus =
    !card.href && ["content", "review", "needs", "increment"].includes(card.kind)
      ? '<span class="link-missing">链接待补</span>'
      : "";

  return `<article class="${classes}" data-kind="${escapeHtml(card.kind)}" data-tags="${escapeHtml(card.tags.join(" "))}">
    ${cover}
    <div class="card-body">
      <p class="card-topic">${escapeHtml(card.topic)}</p>
      ${renderTitle(card)}
      ${metaMarkup}
      ${renderMetrics(card)}
      ${linkStatus}
    </div>
  </article>`;
}

function cardsForCurrentState() {
  const cards = data.periods[state.period].groups[state.group] || [];
  if (state.filter === "all") return cards;
  return cards.filter((card) => card.tags.includes(state.filter));
}

function renderCurrentCards() {
  const cards = cardsForCurrentState();
  currentStream.innerHTML = cards.length
    ? cards.map(renderCard).join("")
    : '<p class="empty-state">暂无该主题内容</p>';

  const activePeriodTab = periodTabs.find(
    (tab) => tab.dataset.period === state.period,
  );
  if (activePeriodTab) {
    currentStream.setAttribute("aria-labelledby", activePeriodTab.id);
  }
  resultStatus.textContent = `${data.periods[state.period].label} ${data.groupLabels[state.group]} ${cards.length} 条`;
}

function availableGroups(period) {
  return groupOrder.filter(
    (group) => (data.periods[period].groups[group] || []).length > 0,
  );
}

function renderGroupTabs() {
  const available = availableGroups(state.period);
  if (!available.includes(state.group)) {
    state.group = available[0] || "all";
  }

  groupTabs.innerHTML = available
    .map((group) => {
      const count = data.periods[state.period].groups[group].length;
      return `<button class="group-button" type="button" data-group="${escapeHtml(group)}" aria-pressed="${group === state.group}">${escapeHtml(data.groupLabels[group])} ${count}</button>`;
    })
    .join("");

  groupTabs.querySelectorAll(".group-button").forEach((button) => {
    button.addEventListener("click", () => {
      state.group = button.dataset.group;
      renderGroupTabs();
      renderCurrentCards();
    });
  });
}

function activatePeriod(period, focus = false) {
  state.period = period;
  periodTabs.forEach((tab) => {
    const active = tab.dataset.period === period;
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
    if (active && focus) tab.focus();
  });
  renderGroupTabs();
  renderCurrentCards();
}

function renderFilters() {
  topicFilters.innerHTML = data.filters
    .map(
      (filter) =>
        `<button class="filter-button" type="button" data-filter="${escapeHtml(filter.id)}" aria-pressed="${filter.id === state.filter}">${escapeHtml(filter.label)}</button>`,
    )
    .join("");

  topicFilters.querySelectorAll(".filter-button").forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      topicFilters.querySelectorAll(".filter-button").forEach((item) => {
        item.setAttribute(
          "aria-pressed",
          String(item.dataset.filter === state.filter),
        );
      });
      renderCurrentCards();
    });
  });
}

periodTabs.forEach((tab) => {
  tab.addEventListener("click", () => activatePeriod(tab.dataset.period));
  tab.addEventListener("keydown", (event) => {
    const index = periodTabs.indexOf(tab);
    let nextIndex = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % periodTabs.length;
    if (event.key === "ArrowLeft") {
      nextIndex = (index - 1 + periodTabs.length) % periodTabs.length;
    }
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = periodTabs.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    activatePeriod(periodTabs[nextIndex].dataset.period, true);
  });
});

function renderArchiveGroup(dayElement, day, group) {
  const tabs = dayElement.querySelector(".history-group-tabs");
  const stream = dayElement.querySelector(".history-card-grid");
  const cards = day.groups[group] || [];
  dayElement.dataset.activeGroup = group;

  tabs.querySelectorAll(".group-button").forEach((button) => {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.group === group),
    );
  });
  stream.innerHTML = cards.length
    ? cards.map(renderCard).join("")
    : '<p class="empty-state">当日未单列该类内容</p>';
}

function setArchiveOpen(dayElement, open) {
  const toggle = dayElement.querySelector(".date-toggle");
  const content = dayElement.querySelector(".history-content");
  dayElement.classList.toggle("open", open);
  toggle.setAttribute("aria-expanded", String(open));
  content.hidden = !open;
}

function renderArchive() {
  archiveList.innerHTML = data.archive
    .map((day) => {
      const available = groupOrder.filter((group) => day.counts[group] > 0);
      const active = available[0] || "all";
      return `<section class="history-day" data-date="${escapeHtml(day.date)}" data-active-group="${escapeHtml(active)}">
        <button class="date-toggle" type="button" aria-expanded="false" aria-controls="history-${escapeHtml(day.date)}">
          <span class="past-date">${escapeHtml(day.label)}</span>
          <span class="chevron" aria-hidden="true">⌄</span>
        </button>
        <div class="history-content" id="history-${escapeHtml(day.date)}" hidden>
          <div class="group-tabs history-group-tabs" role="group" aria-label="${escapeHtml(day.label)}内容分类">
            ${available
              .map(
                (group) =>
                  `<button class="group-button" type="button" data-group="${escapeHtml(group)}" aria-pressed="${group === active}">${escapeHtml(data.groupLabels[group])} ${day.counts[group]}</button>`,
              )
              .join("")}
          </div>
          <div class="card-grid history-card-grid"></div>
        </div>
      </section>`;
    })
    .join("");

  const dayElements = [...archiveList.querySelectorAll(".history-day")];
  dayElements.forEach((dayElement) => {
    const day = data.archive.find(
      (item) => item.date === dayElement.dataset.date,
    );
    const toggle = dayElement.querySelector(".date-toggle");
    renderArchiveGroup(dayElement, day, dayElement.dataset.activeGroup);

    toggle.addEventListener("click", () => {
      dayElement.dataset.userToggled = "true";
      setArchiveOpen(dayElement, !dayElement.classList.contains("open"));
      archiveObserver?.unobserve(dayElement);
    });

    dayElement.querySelectorAll(".history-group-tabs .group-button").forEach(
      (button) => {
        button.addEventListener("click", () => {
          renderArchiveGroup(dayElement, day, button.dataset.group);
        });
      },
    );
  });

  if ("IntersectionObserver" in window) {
    archiveObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (
            entry.isIntersecting &&
            window.scrollY > 320 &&
            entry.target.dataset.userToggled !== "true"
          ) {
            setArchiveOpen(entry.target, true);
            archiveObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.3 },
    );
    dayElements.forEach((dayElement) => archiveObserver.observe(dayElement));
  }
}

let archiveObserver = null;

if (data) {
  currentDate.textContent = data.updatedLabel;
  renderFilters();
  renderGroupTabs();
  renderCurrentCards();
  renderArchive();
} else {
  currentDate.textContent = "数据未载入";
  currentStream.innerHTML = '<p class="empty-state">请重新生成站点数据</p>';
}
