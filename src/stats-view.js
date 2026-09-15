import { circuitKey } from "./stats.js";
export function statsView(
  profile,
  tracks,
  cars,
  { heading, escape, formatTime },
) {
  const s = profile.stats,
    n = (v) => Math.round(v || 0).toLocaleString(),
    duration = (v) =>
      `${Math.floor((v || 0) / 3600)}h ${Math.floor(((v || 0) % 3600) / 60)}m`,
    distance = (v) => `${((v || 0) / 1000).toFixed(2)} km`,
    carName = (id) => cars.find((c) => c.id === id)?.name || id;
  const fav = (items) =>
    Object.entries(items)
      .filter(([, v]) => v.seconds > 0)
      .sort((a, b) => b[1].seconds - a[1].seconds)[0];
  const ft = fav(s.tracks),
    fc = fav(s.cars);
  const tile = (label, value, detail = "") =>
    `<article class="stat-tile"><span class="eyebrow">${label}</span><strong>${value}</strong><small>${detail}</small></article>`;
  const bestFor = (t) => {
    const values = Object.entries(profile.records)
      .filter(([key]) =>
        t.features?.length
          ? key.startsWith(`${t.name}|${circuitKey(t)}|`)
          : key.startsWith(t.name + "|") &&
            !key.slice(t.name.length + 1).includes("|"),
      )
      .map(([, v]) => v);
    const best = s.tracks[circuitKey(t)]?.best;
    return Math.min(...values, ...(best ? [best] : []));
  };
  const row = (t) => {
    const v = s.tracks[circuitKey(t)] || {};
    return `<tr><th>${escape(t.name)}</th><td class="timing">${formatTime(bestFor(t))}</td><td>${n(v.laps)}</td><td>${n(v.cleanLaps)}</td><td>${n(v.starts)}</td><td>${n(v.wins)}</td><td>${n(v.crashes)}</td><td>${duration(v.seconds)}</td><td>${distance(v.distance)}</td></tr>`;
  };
  const recent = s.lapHistory.slice(-20).reverse();
  const vals = s.lapHistory.map((x) => x.time),
    avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  const totalGP = s.modes.race?.completed || 0;
  const bar = (label, value, max) =>
    `<div class="history-bar"><span>${escape(label)}</span><div><b style="width:${max ? (value / max) * 100 : 0}%"></b></div><strong>${n(value)}</strong></div>`;
  return `${heading("THE DRIVER DOSSIER", "Every lap. <em>Every little victory.</em>", "Your racing life, recorded on this device.")}<div class="stats-intro"><span class="tiny">CLUB DRIVER / 001</span><span>Tracking since ${new Date(s.since).toLocaleDateString()} · browser storage</span></div><section class="stats-hero">${tile("TOTAL LAPS", n(s.laps), "Across every circuit and mode")}${tile("TIME ON CIRCUIT", duration(s.seconds), "Active driving time, excluding pauses")}${tile("DISTANCE DRIVEN", distance(s.distance), "Virtual circuit metres")}${tile("GRAND PRIX WINS", n(s.wins), `${totalGP ? Math.round((s.wins / totalGP) * 100) : 0}% win rate · ${n(totalGP)} completed`)}</section><section class="favourites"><article><span class="eyebrow">FAVOURITE CIRCUIT / BY TIME DRIVEN</span><h2>${ft ? escape(ft[1].name) : "Your story starts on the grid."}</h2><p>${ft ? `${duration(ft[1].seconds)} behind the trigger · ${n(ft[1].laps)} laps` : "Run a few laps to find your favourite."}</p></article><article><span class="eyebrow">FAVOURITE CAR / BY TIME DRIVEN</span>${fc ? `<img src="/images/cars/${encodeURIComponent(fc[0])}.webp" alt="${escape(carName(fc[0]))}">` : ""}<h2>${fc ? escape(carName(fc[0])) : "An open garage. Endless possibilities."}</h2><p>${fc ? `${duration(fc[1].seconds)} driven · ${n(fc[1].laps)} laps` : "Choose a car and make it yours."}</p></article></section><section class="stats-small">${[
    ["CLUB CREDITS", n(profile.credits) + " CR"],
    ["GARAGE SPEND", n(profile.creditsSpent) + " CR"],
    ["SESSIONS STARTED", n(s.starts)],
    ["SESSIONS COMPLETED", n(s.completed)],
    ["CLEAN LAPS", n(s.cleanLaps)],
    [
      "CLEAN LAP RATE",
      s.laps ? `${Math.round((s.cleanLaps / s.laps) * 100)}%` : "—",
    ],
    ["DESLOTS", n(s.crashes)],
    ["RE-SLOTS", n(s.reslots)],
    ["JUMP ATTEMPTS", n(s.jumps)],
    ["CLEAN LANDINGS", n(s.landings)],
    ["LOOPS CLEARED", n(s.loops)],
    ["COLLISIONS", n(s.collisions)],
    ["PIT STOPS", n(s.pitStops)],
    ["PIT TIME", duration(s.pitSeconds)],
    ["TOP SPEED", `${Math.round(s.topSpeed * 7.2)} km/h`],
    [
      "AVERAGE SPEED",
      s.seconds ? `${((s.distance / s.seconds) * 7.2).toFixed(1)} km/h` : "—",
    ],
    ["ON THROTTLE", duration(s.throttleSeconds)],
    ["ON BRAKES", duration(s.brakeSeconds)],
    ["CARS COLLECTED", `${profile.owned.length} / ${cars.length}`],
    [
      "CARS DRIVEN",
      n(Object.values(s.cars).filter((v) => v.seconds > 0).length),
    ],
    [
      "CIRCUITS DRIVEN",
      n(Object.values(s.tracks).filter((v) => v.seconds > 0).length),
    ],
    ["CUSTOM CIRCUITS", n(profile.tracks.length)],
    ["CAR / TRACK RECORDS", n(Object.keys(profile.records).length)],
    ["RECENT AVERAGE LAP", avg ? formatTime(avg) : "—"],
  ]
    .map(([l, v]) => tile(l, v))
    .join(
      "",
    )}</section><section class="stats-panel"><div class="section-heading"><h2>Circuit ledger</h2><span class="tiny muted">PERSONAL BESTS + LIFETIME TOTALS</span></div><div class="table-scroll"><table class="stats-table"><thead><tr>${["Circuit", "Fastest lap", "Laps", "Clean", "Starts", "Wins", "Deslots", "Time", "Distance"].map((x) => `<th>${x}</th>`).join("")}</tr></thead><tbody>${tracks.map(row).join("")}</tbody></table></div></section><section class="stats-columns"><section class="stats-panel"><div class="section-heading"><h2>Your most raced circuits</h2><span class="tiny muted">LAPS</span></div>${
    Object.values(s.tracks).some((v) => v.laps)
      ? Object.values(s.tracks)
          .sort((a, b) => b.laps - a.laps)
          .slice(0, 6)
          .map((v) =>
            bar(
              v.name,
              v.laps,
              Math.max(...Object.values(s.tracks).map((v) => v.laps)),
            ),
          )
          .join("")
      : '<p class="empty-state">The leaderboard is waiting for your first lap.</p>'
  }</section><section class="stats-panel"><div class="section-heading"><h2>How you race</h2><span class="tiny muted">SESSIONS</span></div>${[
    ["race", "Grand Prix"],
    ["time", "Time trial"],
    ["practice", "Free run"],
  ]
    .map(([id, label]) => bar(label, s.modes[id]?.starts || 0, s.starts))
    .join(
      "",
    )}</section></section><details class="stats-panel"><summary>Garage logbook · all ${cars.length} cars</summary><div class="table-scroll"><table class="stats-table"><thead><tr>${["Car", "Laps", "Starts", "Wins", "Deslots", "Time", "Distance", "Top speed"].map((x) => `<th>${x}</th>`).join("")}</tr></thead><tbody>${cars
    .map((c) => {
      const v = s.cars[c.id] || {};
      return `<tr><th>${escape(c.name)}</th><td>${n(v.laps)}</td><td>${n(v.starts)}</td><td>${n(v.wins)}</td><td>${n(v.crashes)}</td><td>${duration(v.seconds)}</td><td>${distance(v.distance)}</td><td>${Math.round((v.topSpeed || 0) * 7.2)} km/h</td></tr>`;
    })
    .join(
      "",
    )}</tbody></table></div></details><section class="stats-columns"><section class="stats-panel"><h2>Recent laps</h2><p class="muted stats-caption">Latest 20 · up to 200 laps stored</p>${recent.length ? recent.map((l) => `<div class="log-row"><div><strong>${escape(l.track)}</strong><small>${escape(carName(l.car))} · ${escape(l.result)}</small></div><b class="timing">${formatTime(l.time)}</b></div>`).join("") : '<p class="empty-state">Complete a lap to put a time on the board.</p>'}</section><section class="stats-panel"><h2>Session history</h2><p class="muted stats-caption">Latest 20 · up to 50 sessions stored</p>${
    s.history.length
      ? s.history
          .slice(-20)
          .reverse()
          .map(
            (h) =>
              `<div class="log-row"><div><strong>${escape(h.track)}</strong><small>${escape(carName(h.car))} · ${n(h.laps)} laps · ${escape(h.result)}</small></div><b class="timing">${formatTime(h.time)}</b></div>`,
          )
          .join("")
      : '<p class="empty-state">Finished and exited sessions appear here.</p>'
  }</section></section><details class="stats-panel"><summary>All car / circuit personal bests</summary><div class="table-scroll"><table class="stats-table"><thead><tr><th>Circuit</th><th>Car</th><th>Fastest lap</th></tr></thead><tbody>${
    Object.entries(profile.records)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, v]) => {
        const split = key.lastIndexOf("|");
        return `<tr><th>${escape(key.slice(0, split).replace(/\|circuit-[a-z0-9]+$/, " · Stunt layout"))}</th><td>${escape(carName(key.slice(split + 1)))}</td><td class="timing">${formatTime(v)}</td></tr>`;
      })
      .join("") || '<tr><td colspan="3">No lap records yet.</td></tr>'
  }</tbody></table></div></details><p class="legal-note">Existing personal bests are preserved. New counters begin with this update; earlier laps, wins and driving time cannot be reconstructed. Favourites use active session time. Speed follows the game’s scale display. Recent average lap combines the last 200 stored laps across circuits.</p>`;
}
