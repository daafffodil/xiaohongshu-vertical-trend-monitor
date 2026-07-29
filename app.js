const tabs = [...document.querySelectorAll(".tab")];
tabs.forEach((tab) =>
  tab.addEventListener("click", () => {
    tabs.forEach((item) => item.setAttribute("aria-selected", "false"));
    document.querySelectorAll(".period-panel").forEach((panel) => {
      panel.hidden = true;
    });
    tab.setAttribute("aria-selected", "true");
    document.getElementById(tab.dataset.target).hidden = false;
  }),
);

const filters = [...document.querySelectorAll(".filter")];
filters.forEach((filter) =>
  filter.addEventListener("click", () => {
    const theme = filter.dataset.theme;
    filters.forEach((item) => item.setAttribute("aria-pressed", "false"));
    filter.setAttribute("aria-pressed", "true");
    document.querySelectorAll(".signal-card").forEach((card) => {
      card.hidden = theme !== "all" && card.dataset.theme !== theme;
    });
  }),
);
