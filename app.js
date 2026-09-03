/* Frisk & Swing — main app
   - Renders schedule
   - Style filter
   - Mobile nav toggle
   - Year stamp
*/

(function () {
  const grid = document.getElementById("scheduleGrid");
  if (!grid) return;

  function pillFor(level) {
    const map = { beg: "pill--beg", imp: "pill--imp", int: "pill--int", adv: "pill--int", all: "pill--int" };
    return `<span class="pill ${map[level] || ""}">${LEVEL_LABEL[level] || ""}</span>`;
  }
  function colabTag(name) {
    return /collab/i.test(name) ? `<span class="pill pill--col">Collab</span>` : "";
  }

  function rowHTML(day) {
    const items = day.items.map(it => `
      <a class="cls" data-style="${it.style}" data-level="${it.level}"
         href="https://bit.ly/iwantfreetrial" target="_blank" rel="noopener"
         aria-label="Book trial for ${it.name}">
        <div class="cls__time">${it.time} · Studio ${it.room}</div>
        <div class="cls__name">${it.name}</div>
        <div class="cls__meta">${it.instructors}</div>
        <div class="cls__tags">
          ${pillFor(it.level)}
          ${colabTag(it.name)}
        </div>
      </a>
    `).join("");
    return `
      <div class="day" data-day="${day.day}">
        <div class="day__name">${day.day}<span>${day.items.length} class${day.items.length>1?"es":""}</span></div>
        <div class="day__items">${items}</div>
      </div>
    `;
  }

  function render(filter) {
    const html = SCHEDULE.map(d => {
      const items = filter === "all" ? d.items : d.items.filter(i => i.style === filter);
      if (!items.length) return "";
      return rowHTML({ ...d, items });
    }).filter(Boolean).join("");
    grid.innerHTML = html || `<p class="muted" style="text-align:center">No classes match this filter.</p>`;
  }

  render("all");

  // Filter chips
  document.querySelectorAll(".filterbar .chip").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filterbar .chip").forEach(b => {
        b.classList.remove("is-active");
        b.setAttribute("aria-selected", "false");
      });
      btn.classList.add("is-active");
      btn.setAttribute("aria-selected", "true");
      render(btn.dataset.filter);
    });
  });

  // Mobile nav
  const navtoggle = document.querySelector(".navtoggle");
  const mobnav = document.getElementById("mobnav");
  if (navtoggle && mobnav) {
    navtoggle.addEventListener("click", () => {
      const open = navtoggle.getAttribute("aria-expanded") === "true";
      navtoggle.setAttribute("aria-expanded", String(!open));
      navtoggle.setAttribute("aria-label", open ? "Open menu" : "Close menu");
      mobnav.classList.toggle("is-open", !open);
    });
    mobnav.querySelectorAll("a").forEach(a => {
      a.addEventListener("click", () => {
        navtoggle.setAttribute("aria-expanded", "false");
        navtoggle.setAttribute("aria-label", "Open menu");
        mobnav.classList.remove("is-open");
      });
    });
  }

  // Year stamp
  const yr = document.getElementById("yr");
  if (yr) yr.textContent = new Date().getFullYear();
})();
