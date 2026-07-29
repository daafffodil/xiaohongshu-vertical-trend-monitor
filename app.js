const tabs = [...document.querySelectorAll(".tab")];

function activateTab(tab, focus = false) {
  tabs.forEach((item) => {
    const isActive = item === tab;
    item.setAttribute("aria-selected", String(isActive));
    item.tabIndex = isActive ? 0 : -1;
  });

  document.querySelectorAll(".period-panel").forEach((panel) => {
    panel.hidden = panel.id !== tab.dataset.target;
  });

  if (focus) {
    tab.focus();
  }
}

tabs.forEach((tab) => {
  tab.tabIndex = tab.getAttribute("aria-selected") === "true" ? 0 : -1;

  tab.addEventListener("click", () => {
    activateTab(tab);
  });

  tab.addEventListener("keydown", (event) => {
    const currentIndex = tabs.indexOf(tab);
    let nextIndex = null;

    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabs.length;
    if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;

    if (nextIndex !== null) {
      event.preventDefault();
      activateTab(tabs[nextIndex], true);
    }
  });
});

document.querySelectorAll(".search-link").forEach((link) => {
  const searchUrl = new URL("https://www.xiaohongshu.com/search_result");
  searchUrl.searchParams.set("keyword", link.dataset.title);
  searchUrl.searchParams.set("source", "web_search_result_notes");
  searchUrl.searchParams.set("type", "51");
  link.href = searchUrl.toString();
});

function fallbackCopy(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  return copied;
}

document.querySelectorAll(".copy-title").forEach((button) => {
  button.type = "button";
  button.setAttribute("aria-label", `复制标题：${button.dataset.copy}`);

  button.addEventListener("click", async () => {
    const originalLabel = button.textContent;
    let copied = false;

    try {
      await navigator.clipboard.writeText(button.dataset.copy);
      copied = true;
    } catch {
      copied = fallbackCopy(button.dataset.copy);
    }

    button.textContent = copied ? "已复制" : "复制失败";
    const copyStatus = document.getElementById("copy-status");
    if (copyStatus) {
      copyStatus.textContent = copied
        ? `已复制标题：${button.dataset.copy}`
        : `复制失败：${button.dataset.copy}`;
    }

    window.setTimeout(() => {
      button.textContent = originalLabel;
      if (copyStatus) copyStatus.textContent = "";
    }, 1400);
  });
});
