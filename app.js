const tabs = [...document.querySelectorAll(".tab")];

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((item) => item.setAttribute("aria-selected", "false"));
    document.querySelectorAll(".period-panel").forEach((panel) => {
      panel.hidden = true;
    });

    tab.setAttribute("aria-selected", "true");
    document.getElementById(tab.dataset.target).hidden = false;
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

    window.setTimeout(() => {
      button.textContent = originalLabel;
    }, 1400);
  });
});
