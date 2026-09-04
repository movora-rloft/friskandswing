/* Frisk & Swing — main app
 *   - Renders schedule (from /api/schedule, with bundled fallback)
 *   - Style filter (chips generated dynamically from the schedule's genres)
 *   - Mobile nav toggle
 *   - Year stamp
 *
 * The schedule is now sourced from a Google Sheet via a Cloudflare Worker.
 * Edit the sheet, then hit /api/schedule?refresh=1 to invalidate the cache.
 * A bundled SCHEDULE in schedule.js is used as a last-resort fallback if the
 * Worker is unreachable.
 */

(function () {
  const grid = document.getElementById("scheduleGrid");
  if (!grid) return;

  // ----- Level labels (covers both sheet rows and bundled fallback) -----
  const LEVEL_LABEL = {
    // sheet-format (long names)
    "foundation":   "Foundation",
    "foundation 1": "Foundation 1",
    "improver":     "Improver",
    "intermediate": "Intermediate",
    "advanced":     "Advanced",
    "open level":   "Open Level",
    // bundled-fallback short codes
    beg: "Beginner",
    imp: "Improver",
    int: "Intermediate",
    adv: "Advanced",
    all: "All levels",
  };

  // ----- Schedule fetch -----
  const FALLBACK = Array.isArray(window.SCHEDULE) ? window.SCHEDULE : [];
  let DATA = null;          // { days: [...], genres: [...] }
  let SOURCE_NOTE = null;   // human-readable footer ("Last updated: …")

  const GENRE_PILL = {
    salsa: "chip--salsa", bachata: "chip--bachata", zouk: "chip--zouk",
    kizomba: "chip--kizomba",
  };

  async function loadSchedule() {
    try {
      const r = await fetch("/api/schedule", { cache: "no-store" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const j = await r.json();
      if (!j.ok || !Array.isArray(j.days)) throw new Error("bad payload");
      DATA = { days: j.days, genres: (j.genres || []).map(g => g.toLowerCase()) };
      const ts = j.cachedAt ? new Date(j.cachedAt) : null;
      SOURCE_NOTE = ts
        ? `Showing schedule cached ${ts.toLocaleString("en-MY", { dateStyle: "medium", timeStyle: "short" })}`
        : null;
    } catch (err) {
      // Fall back to bundled SCHEDULE so the page is never empty.
      DATA = { days: FALLBACK, genres: [...new Set(FALLBACK.flatMap(d => d.items.map(i => i.style)))] };
      SOURCE_NOTE = "Live schedule temporarily unavailable — showing the last bundled snapshot.";
      console.warn("[schedule] falling back to bundled:", err);
    }
    renderChips();
    render("all");
    renderNote();
  }

  // ----- Filter chips (built from the schedule, not hard-coded) -----
  function renderChips() {
    const bar = document.querySelector(".filterbar");
    if (!bar) return;
    bar.innerHTML = "";
    const all = document.createElement("button");
    all.className = "chip is-active";
    all.dataset.filter = "all";
    all.type = "button";
    all.setAttribute("role", "tab");
    all.setAttribute("aria-selected", "true");
    all.textContent = "All";
    bar.appendChild(all);
    for (const g of DATA.genres) {
      const b = document.createElement("button");
      b.className = "chip " + (GENRE_PILL[g] || "");
      b.dataset.filter = g;
      b.type = "button";
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", "false");
      b.textContent = g.charAt(0).toUpperCase() + g.slice(1);
      bar.appendChild(b);
    }
    // Re-bind clicks after rebuilding chips.
    bar.querySelectorAll(".chip").forEach(btn => {
      btn.addEventListener("click", () => {
        bar.querySelectorAll(".chip").forEach(x => {
          x.classList.remove("is-active");
          x.setAttribute("aria-selected", "false");
        });
        btn.classList.add("is-active");
        btn.setAttribute("aria-selected", "true");
        render(btn.dataset.filter);
      });
    });
  }

  // ----- Schedule rendering -----
  function pillFor(level) {
    const map = {
      "foundation": "pill--beg", "foundation 1": "pill--beg", "beg": "pill--beg",
      "improver": "pill--imp", "imp": "pill--imp",
      "intermediate": "pill--int", "int": "pill--int", "advanced": "pill--int", "adv": "pill--int",
      "open level": "pill--int", "all": "pill--int",
    };
    return `<span class="pill ${map[(level || "").toLowerCase()] || ""}">${LEVEL_LABEL[level] || level}</span>`;
  }
  function colabTag(name) {
    return /collab/i.test(name) ? `<span class="pill pill--col">Collab</span>` : "";
  }

  function rowHTML(day) {
    const items = day.items.map(it => `
      <a class="cls" data-style="${it.style}" data-level="${it.level}"
         href="#trial"
         aria-label="Book trial for ${it.name}">
        <div class="cls__time">${it.time} · Studio ${it.room}</div>
        <div class="cls__name">${it.name}</div>
        <div class="cls__meta">${it.instructors || '<span class="cls__tba">TBA</span>'}</div>
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

  // Intercept schedule class clicks: pre-select the dance on the trial
  // form, then smooth-scroll to it. We preventDefault so the browser
  // doesn't do a hard anchor jump.
  grid.addEventListener("click", (e) => {
    const a = e.target.closest("a.cls");
    if (!a) return;
    e.preventDefault();
    const style = (a.dataset.style || "").toLowerCase();
    const form = document.getElementById("trialForm");
    const sel = form && form.elements.dance;
    if (sel && style) {
      const want = style.charAt(0).toUpperCase() + style.slice(1);
      for (const opt of sel.options) {
        if (opt.value.toLowerCase() === style) {
          sel.value = opt.value;
          break;
        }
      }
      // Reflect in URL for shareability / back-button
      history.replaceState(null, "", `#trial&dance=${encodeURIComponent(style)}`);
    }
    const target = document.getElementById("trial");
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      // Focus the first empty input on the form (Name) so the user can type
      setTimeout(() => {
        if (form && form.elements.name) form.elements.name.focus({ preventScroll: true });
      }, 700);
    }
  });

  function render(filter) {
    if (!DATA) return;
    const html = DATA.days.map(d => {
      const items = filter === "all" ? d.items : d.items.filter(i => i.style === filter);
      if (!items.length) return "";
      return rowHTML({ ...d, items });
    }).filter(Boolean).join("");
    grid.innerHTML = html || `<p class="muted" style="text-align:center">No classes match this filter.</p>`;
  }

  function renderNote() {
    const note = document.querySelector(".schedule__note");
    if (!note) return;
    if (SOURCE_NOTE) {
      note.textContent = SOURCE_NOTE + " · Confirm via Instagram DM before your visit.";
    }
  }

  // ----- Mobile nav -----
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

  // ----- Year stamp -----
  const yr = document.getElementById("yr");
  if (yr) yr.textContent = new Date().getFullYear();

  // Kick off the schedule load.
  loadSchedule();
})();
