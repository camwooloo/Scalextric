import { tiers, ratingLabels } from "./economy.js";
export const PAGE_SIZE = 24;
export function garageList(profile, cars, shop, filter) {
  const list = cars.filter(
    (c) =>
      (shop || profile.owned.includes(c.id)) &&
      c.name.toLowerCase().includes(filter.query.toLowerCase()) &&
      (filter.era === "all" ||
        (filter.era === "retro" ? +c.year < 2000 : +c.year >= 2000)) &&
      (filter.tier === "all" || c.tier === +filter.tier),
  );
  list.sort(
    filter.sort === "price-high"
      ? (a, b) => b.price - a.price || a.name.localeCompare(b.name)
      : filter.sort === "name"
        ? (a, b) => a.name.localeCompare(b.name)
        : (a, b) => a.price - b.price || a.name.localeCompare(b.name),
  );
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  filter.page = Math.max(0, Math.min(filter.page, pages - 1));
  return {
    total: list.length,
    pages,
    items: list.slice(filter.page * PAGE_SIZE, (filter.page + 1) * PAGE_SIZE),
  };
}
export function garageCards(profile, list, { i, carArt, escape }) {
  return (
    list.items
      .map(
        (c) =>
          `<article class="car-card" data-car-name="${escape(c.name.toLowerCase())}" data-year="${escape(c.year)}"><div class="car-card-top"><span class="class-badge class-${tiers[c.tier].letter}">${tiers[c.tier].letter} / ${tiers[c.tier].name}</span><span class="tiny">${escape(c.year)}</span></div><div class="car-stage" style="--car-color:${c.color}"><span class="car-bg-number">${c.number}</span>${carArt(c)}</div><h2>${escape(c.name)}</h2><p class="car-character">${c.archetype}</p><div class="rating-list">${Object.entries(
            ratingLabels,
          )
            .map(([key, label]) => {
              const score = c.ratings[key],
                adjective = {
                  speed: [
                    "Cruiser",
                    "Quick",
                    "Rapid",
                    "Blistering",
                    "Ultimate",
                  ],
                  accel: [
                    "Steady",
                    "Responsive",
                    "Punchy",
                    "Explosive",
                    "Lightning",
                  ],
                  grip: [
                    "Balanced",
                    "Nimble",
                    "Planted",
                    "Precision",
                    "Rail-like",
                  ],
                  braking: [
                    "Measured",
                    "Assured",
                    "Strong",
                    "Sharp",
                    "Race-grade",
                  ],
                  jump: [
                    "Settled",
                    "Balanced",
                    "Air-ready",
                    "Precise",
                    "Stunt master",
                  ],
                  downforce: [
                    "Light",
                    "Assured",
                    "Planted",
                    "High aero",
                    "Maximum",
                  ],
                  stability: [
                    "Settled",
                    "Composed",
                    "Predictable",
                    "Locked-in",
                    "Unshakeable",
                  ],
                }[key][c.tier];
              return `<div class="rating"><div class="rating-label"><span>${label}</span><b>${adjective} <small>${score}</small></b></div><div class="rating-segments" role="meter" aria-label="${label}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${score}">${[0, 1, 2, 3, 4].map((n) => `<span><b style="width:${Math.max(0, Math.min(100, (score - n * 20) * 5))}%"></b></span>`).join("")}</div></div>`;
            })
            .join(
              "",
            )}</div><div class="car-price"><span>${profile.owned.includes(c.id) ? "GARAGE VALUE" : "CLUB PRICE"}</span><strong>${c.price.toLocaleString()} <small>CR</small></strong></div><button class="${profile.selected === c.id ? "chosen-btn" : "outline-btn"} wide" data-car="${c.id}">${profile.selected === c.id ? `${i("Check")} Selected for racing` : profile.owned.includes(c.id) ? "Select car" : `Buy for ${c.price.toLocaleString()} CR ${i("Plus")}`}</button></article>`,
      )
      .join("") ||
    '<div class="garage-empty"><h2>No cars on this grid.</h2><p>Try another name, era or class.</p></div>'
  );
}
export function garagePagination(list, filter) {
  return `<button class="outline-btn" data-garage-step="-1" ${filter.page === 0 ? "disabled" : ""}>← Previous</button><span>PAGE ${filter.page + 1} / ${list.pages} · ${list.total} CARS</span><button class="outline-btn" data-garage-step="1" ${filter.page + 1 >= list.pages ? "disabled" : ""}>Next →</button>`;
}
export function garageView(profile, cars, shop, filter, helpers) {
  const { heading, i, escape } = helpers,
    list = garageList(profile, cars, shop, filter);
  return `${heading(shop ? "THE MOTOR EXCHANGE" : "YOUR PERSONAL PIT LANE", shop ? "Find your <em>next obsession.</em>" : "A garage with <em>good taste.</em>", shop ? `${cars.length} licensed models. Five performance classes. Your next starting line awaits.` : `${profile.owned.length} cars collected. Pick a race partner.`, `<button class="orange-btn" data-page="race">Race selected ${i("ArrowRight")}</button>`)}<div class="wallet-banner"><div><span class="eyebrow">YOUR CLUB CREDITS</span><strong id="credit-balance">${profile.credits.toLocaleString()} <small>CR</small></strong></div><p>100 million starting credits.<br>Local sandbox currency. No real money.</p></div><div class="garage-tools"><input id="car-search" type="search" aria-label="Search cars" placeholder="Find your icon…" value="${escape(filter.query)}"><select id="car-era" aria-label="Filter car era">${[
    ["all", "Every era"],
    ["retro", "Retro · before 2000"],
    ["modern", "Modern · 2000 onward"],
  ]
    .map(
      ([v, l]) =>
        `<option value="${v}" ${filter.era === v ? "selected" : ""}>${l}</option>`,
    )
    .join(
      "",
    )}</select><select id="car-tier" aria-label="Filter performance class"><option value="all">Every class</option>${tiers.map((t, j) => `<option value="${j}" ${filter.tier === String(j) ? "selected" : ""}>${t.letter} · ${t.name}</option>`).join("")}</select><select id="car-sort" aria-label="Sort cars">${[
    ["price-low", "Price: low to high"],
    ["price-high", "Price: high to low"],
    ["name", "Name: A to Z"],
  ]
    .map(
      ([v, l]) =>
        `<option value="${v}" ${filter.sort === v ? "selected" : ""}>${l}</option>`,
    )
    .join(
      "",
    )}</select><span id="car-count">${list.total} cars</span></div><p class="garage-guide">Higher classes improve every rating. Within a class, choose straight-line pace, cornering or an all-rounder. These are gameplay ratings, not real-world performance figures.</p><div class="cars-grid">${garageCards(profile, list, helpers)}</div><div class="garage-pagination">${garagePagination(list, filter)}</div><p class="legal-note">Credits, purchases and your collection save on this browser. <a href="/credits.html" target="_blank" rel="noopener">Model artists & licences ↗</a> · Independent fan project.</p>`;
}
