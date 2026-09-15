import {
  baseCurve,
  buildCircuit,
  pieceNames,
  pieceSpan,
  featureAt,
  advanceStunt,
  jumpWindow,
  loopMinimum,
  repairSeconds,
  collisionAt,
  validFeatures,
} from "./stunts.js";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import "@fontsource/dm-sans/latin-700.css";
import "@fontsource/barlow-condensed/latin-500.css";
import "@fontsource/barlow-condensed/latin-600.css";
import "@fontsource/barlow-condensed/latin-700.css";
import "@fontsource/barlow-condensed/latin-800.css";
import "@fontsource/barlow-condensed/latin-900.css";
import "./style.css";
import * as THREE from "three";
import {
  createIcons,
  ArrowRight,
  ArrowUpRight,
  CarFront,
  Check,
  CircleHelp,
  CornerUpRight,
  Download,
  Flag,
  Gamepad2,
  Gauge,
  Gift,
  HardDrive,
  House,
  Info,
  Landmark,
  Layers,
  Lightbulb,
  MoveHorizontal,
  MoveUpRight,
  Shuffle,
  RotateCw,
  Wrench,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Route,
  Save,
  ShoppingBag,
  SlidersHorizontal,
  Spline,
  Trash2,
  Undo2,
  Upload,
  Video,
  Warehouse,
  Zap,
} from "lucide";
const icons = {
  ArrowRight,
  ArrowUpRight,
  CarFront,
  Check,
  CircleHelp,
  CornerUpRight,
  Download,
  Flag,
  Gamepad2,
  Gauge,
  Gift,
  HardDrive,
  House,
  Info,
  Landmark,
  Layers,
  Lightbulb,
  MoveHorizontal,
  MoveUpRight,
  Shuffle,
  RotateCw,
  Wrench,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Route,
  Save,
  ShoppingBag,
  SlidersHorizontal,
  Spline,
  Trash2,
  Undo2,
  Upload,
  Video,
  Warehouse,
  Zap,
};
import {
  emptyStats,
  circuitKey,
  addStats,
  recordLap,
  recordSession,
} from "./stats.js";
import { purchaseCar } from "./economy.js";
import {
  garageView,
  garageList,
  garageCards,
  garagePagination,
} from "./garage-view.js";
import { statsView } from "./stats-view.js";
import { sampleCurvature, stepGrip, resetHandling } from "./handling";
import { World } from "./scene";
import { presets, cars, stepSpeed, cornerLoad } from "./data";
import { load, save, normalize, validTrack } from "./storage";
const $ = (s) => document.querySelector(s);
let profile = load(),
  page = "home",
  selectedTrack = Math.min(
    profile.lastTrack || 0,
    presets.length + profile.tracks.length - 1,
  ),
  mode = profile.racePrefs.mode,
  raceType = profile.racePrefs.type,
  lapTarget = profile.racePrefs.laps,
  world,
  editor = null,
  held = false,
  brake = false,
  manualThrottle = 0,
  paused = false,
  raf = 0,
  toastTimer;
let state = {
  racing: false,
  progress: 0,
  ai: 0,
  speed: 0,
  aiSpeed: 0,
  off: 0,
  slip: 0,
  recovery: 0,
  fly: new THREE.Vector3(),
  cam: "Tabletop",
  time: 0,
  lapTime: 0,
  best: Infinity,
  countdown: 3,
  load: 0,
  crashes: 0,
  finished: false,
};
profile.stats ||= emptyStats();
const garageFilter = {
  query: "",
  era: "all",
  tier: "all",
  sort: "price-low",
  page: 0,
};
let statContext,
  lastStatSave = 0,
  saveQueued = false;
function queueSave() {
  if (saveQueued) return;
  saveQueued = true;
  (window.requestIdleCallback || ((fn) => setTimeout(fn, 0)))(
    () => {
      saveQueued = false;
      persist();
    },
    { timeout: 1500 },
  );
}
function applyTheme() {
  const theme = profile.settings.theme || "dark";
  document.documentElement.dataset.theme =
    theme === "system"
      ? matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute(
      "content",
      document.documentElement.dataset.theme === "dark" ? "#141b1b" : "#f5f4ef",
    );
}
applyTheme();
matchMedia("(prefers-color-scheme: dark)").addEventListener(
  "change",
  applyTheme,
);
const i = (name, cls = "") =>
  `<i data-lucide="${name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()}" class="${cls}"></i>`;
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const allTracks = () => [...presets, ...profile.tracks];
const track = () => allTracks()[selectedTrack] || presets[0];
const car = () => cars.find((c) => c.id === profile.selected) || cars[0];
const personalBestKey = () =>
  `${track().name}|${track().features?.length ? `${circuitKey(track())}|` : ""}${car().id}`;
function persist() {
  if (!save(profile))
    toast("Browser storage is full or unavailable. This session still works.");
}
function iconify() {
  createIcons({ icons });
}
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 3500);
}
function trackSvg(config, cls = "") {
  let pts = config.points;
  const previewCurve = config.features?.length
    ? buildCircuit(config).curve
    : baseCurve(config);
  const d =
    previewCurve
      .getPoints(240)
      .map((p, j) => `${j ? "L" : "M"}${p.x * 4 + 85} ${p.z * 4 + 49}`)
      .join(" ") + " Z";
  return `<svg class="track-map ${cls}" viewBox="0 0 170 100" fill="none"><path d="${d}" stroke="currentColor" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" opacity=".15"/><path d="${d}" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><circle cx="${pts[0][0] * 4 + 85}" cy="${pts[0][1] * 4 + 49}" r="3.5" fill="#ed643c"/></svg>`;
}
function carArt(c) {
  return `<img class="car-art" src="/images/cars/${c.id}.webp" alt="${escape(c.name)} — in-game 3D model" loading="lazy">`;
}
$("#app").innerHTML =
  `<aside class="sidebar"><a href="#home" class="brand" aria-label="Slot Club home"><span class="brand-mark">s<span>c</span></span><span>SLOT<br>CLUB<span class="brand-dot">®</span></span></a><div class="sidebar-section">THE PADDOCK</div><nav>${[
    ["home", "House", "Overview"],
    ["race", "Flag", "Go racing"],
    ["builder", "Spline", "Track studio"],
    ["garage", "Warehouse", "My garage"],
    ["shop", "ShoppingBag", "Car shop"],
    ["stats", "Gauge", "Driver stats"],
  ]
    .map(
      ([p, ic, label]) =>
        `<button data-page="${p}" class="nav-item ${p === "home" ? "active" : ""}">${i(ic)}<span>${label}</span>${p === "shop" ? "<b>133</b>" : ""}</button>`,
    )
    .join(
      "",
    )}</nav><div class="sidebar-bottom"><div class="club-card"><span class="live-dot"></span> SMALL SCALE. NO LIMITS.<p>Your next great race<br>starts right here.</p><span class="tiny">THE 1:32 RACING EXPERIENCE</span></div><button data-page="settings" class="nav-item">${i("SlidersHorizontal")}<span>Settings & controls</span></button><div class="profile"><div class="avatar">DR</div><div><strong>Club driver</strong><small>LOCAL PLAYER</small></div><span class="online"></span></div></div></aside><main><header><div class="breadcrumb">THE PADDOCK <span>/</span> <b id="page-label">OVERVIEW</b></div><div class="header-right"><button class="theme-switch" data-action="theme" aria-label="Toggle dark theme">◐</button><span class="storage-status">${i("HardDrive")} Saved on this device</span><span class="header-line"></span><span class="member">CLUB MEMBER <b>001</b></span></div></header><div id="content"></div><footer><span><span class="live-dot"></span> ALL SYSTEMS GO</span><span>BUILT FOR THE LOVE OF THE RACE.</span><button class="footer-settings" data-page="settings">Settings & controls ↗</button></footer></main><div id="toast" role="status"></div><div id="modal-root"></div>`;
const sceneEl = document.createElement("div");
sceneEl.id = "scene";
try {
  world = new World(sceneEl);
  world.lowDetail = profile.settings.quality !== "high";
  world.build(track());
  world.setCars(car(), cars[4]);
} catch (err) {
  sceneEl.innerHTML =
    '<div class="webgl-error">3D graphics could not start. Enable WebGL or try another browser.</div>';
  console.error(err);
}
function heading(kicker, title, desc, action = "") {
  return `<div class="page-heading"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1><p>${desc}</p></div>${action}</div>`;
}
function home() {
  return `${heading("WELCOME TO THE CLUB", "Small cars. <em>Big racing.</em>", "Build your circuit. Find your limit. Make every lap count.", `<button class="outline-btn" data-action="help">${i("CircleHelp")} How to play</button>`)}<section class="hero"><div id="scene-mount"></div><div class="hero-top"><span class="dark-pill"><span class="live-dot"></span> LIVE CIRCUIT PREVIEW</span><span class="hero-scale">1:32 <span>SCALE / FULL THROTTLE</span></span></div><div class="hero-copy"><div class="eyebrow">YOUR NEXT STARTING LINE</div><h2>${escape(track().name)}</h2><p>${escape(track().description)}</p><div class="hero-meta"><span>${i("Route")} ${world ? Math.round(world.length) : 90}m circuit</span><span>${i("Layers")} 2 lanes</span><span>${i("Gauge")} ${escape(track().difficulty)}</span></div><button class="orange-btn" data-action="quick-start">Quick race ${i("ArrowUpRight")}</button><button class="hero-configure" data-page="race">Configure race →</button></div><div class="hero-stamp">BUILT TO<br><strong>RACE.</strong></div><div class="hero-index"><b>0${selectedTrack + 1}</b><span> / ${String(allTracks().length).padStart(2, "0")}</span><button data-action="next-track" aria-label="Next circuit">${i("ArrowRight")}</button></div></section><section class="quick-grid"><button class="quick-card" data-page="builder"><span class="card-icon orange">${i("Spline")}</span><span><h3>Your track. Your rules.</h3><p>Create something worth racing.</p><b>OPEN TRACK STUDIO ${i("ArrowUpRight")}</b></span><div class="quick-map">${trackSvg(presets[2])}</div></button><button class="quick-card" data-page="shop"><span class="card-icon green">${i("CarFront")}</span><span><h3>Meet your next obsession.</h3><p>Iconic cars. A garage of possibilities.</p><b>EXPLORE THE COLLECTION ${i("ArrowUpRight")}</b></span><span class="free-circle">CARS<br><strong>${cars.length}</strong></span></button></section><section class="lower-grid"><div><div class="section-heading"><h2>Pick your playground<span>0${allTracks().length}</span></h2><button class="text-btn" data-page="tracks">View all tracks ${i("ArrowRight")}</button></div><div class="preset-grid">${allTracks()
    .slice(0, 3)
    .map(
      (t, j) =>
        `<button class="preset-card ${selectedTrack === j ? "selected" : ""}" data-track="${j}"><div class="preset-top"><span class="tiny">0${j + 1} / ${t.bridge ? "ELEVATED" : "CLUB SERIES"}</span>${selectedTrack === j ? '<span class="selected-dot"></span>' : ""}</div>${trackSvg(t)}<h3>${escape(t.name)}</h3><span class="tiny muted">${escape(t.difficulty)} <span class="dot-divider">•</span> ${t.bridge ? "BRIDGE CIRCUIT" : "2 LANE CIRCUIT"}</span></button>`,
    )
    .join(
      "",
    )}</div></div><div class="garage-peek"><div class="section-heading"><h2>In your garage</h2><button class="icon-btn" data-page="garage" aria-label="Open garage">${i("ArrowUpRight")}</button></div><div class="garage-feature"><span class="tiny">${car().type}</span><span class="garage-number">${car().number}</span>${carArt(car())}<h3>${car().name}</h3><div class="garage-caption"><span>${car().year} <span class="dot-divider">/</span> 1:32 SCALE</span><span class="ready"><span class="live-dot"></span> RACE READY</span></div></div></div></section>`;
}
function stuntBriefing() {
  const features = track().features || [];
  if (!features.length) return "";
  const types = [...new Set(features.map((f) => f.type))];
  const details = [];
  if (types.includes("jump"))
    details.push(
      `Jump takeoff: ${Math.round(jumpWindow(car()).min * 7.2)}–${Math.round(jumpWindow(car()).max * 7.2)} km/h.`,
    );
  if (types.includes("loop"))
    details.push(
      `Loop minimum: ${Math.ceil(loopMinimum(car()) * 7.2)} km/h. Keep power through the top.`,
    );
  if (types.some((t) => ["crossover", "intersection"].includes(t)))
    details.push(
      "Watch your rival at shared crossing points; lift or brake to avoid contact.",
    );
  return `<div class="stunt-briefing"><span class="eyebrow">STUNT RACE BRIEFING</span><strong>${types.map((t) => pieceNames[t]).join(" · ")}</strong><p>${details.join(" ")} Crashes mean a 2.5–3.5s crew repair; the race keeps running.</p></div>`;
}
function setup() {
  return `${heading("LIGHTS OUT. HEART RATE UP.", "Find your <em>racing line.</em>", "Choose your circuit, settle into your car, and squeeze the trigger.")}<div class="race-ticket"><div class="ticket-car">${carArt(car())}</div><div><span class="eyebrow">YOUR GRID IS READY</span><h2>${escape(car().name)}</h2><p>${escape(track().name)} · ${raceType === "practice" ? "Unlimited laps" : lapTarget + " laps"} · ${mode === "slot" ? "Classic slot" : "Driver view"}</p></div><button class="orange-btn" data-action="start">To the starting grid ${i("ArrowRight")}</button></div>${stuntBriefing()}<div class="setup-grid"><div class="setup-preview"><div id="scene-mount"></div><div class="preview-caption"><span class="dark-pill">${escape(track().difficulty)}</span><h2>${escape(track().name)}</h2><p>${escape(car().name)} · ${Math.round(world?.length || 0)}m</p><p>PERSONAL BEST · ${formatTime(profile.records[personalBestKey()])}</p></div></div><div class="setup-panel"><h3>01 <span>The experience</span></h3><div class="mode-options"><button data-mode="slot" class="mode-btn ${mode === "slot" ? "selected" : ""}">${i("Gamepad2")}<strong>Classic slot</strong><small>Follow the car. Master the trigger.</small></button><button data-mode="driver" class="mode-btn ${mode === "driver" ? "selected" : ""}">${i("Gauge")}<strong>In the driver's seat</strong><small>Chase, cockpit & bumper cameras.</small></button></div><h3>02 <span>The challenge</span></h3><div class="segmented">${[
    ["race", "Grand Prix"],
    ["time", "Time trial"],
    ["practice", "Free run"],
  ]
    .map(
      ([v, l]) =>
        `<button data-race-type="${v}" class="${raceType === v ? "selected" : ""}">${l}</button>`,
    )
    .join(
      "",
    )}</div><div class="field-row"><label>Circuit<select id="track-select">${allTracks()
    .map(
      (t, j) =>
        `<option value="${j}" ${selectedTrack === j ? "selected" : ""}>${escape(t.name)}</option>`,
    )
    .join(
      "",
    )}</select></label><label>Laps<select id="lap-select">${[3, 5, 10].map((n) => `<option ${lapTarget === n ? "selected" : ""}>${n}</option>`).join("")}</select></label></div><label class="full-label">Your car<select id="car-select">${cars
    .filter((c) => profile.owned.includes(c.id))
    .map(
      (c) =>
        `<option value="${c.id}" ${car().id === c.id ? "selected" : ""}>${c.name}</option>`,
    )
    .join(
      "",
    )}</select></label><div class="tip">${i("Lightbulb")}<span>Speed wins straights. Patience wins corners. Ease off before a bend to keep your car in its slot.</span></div><p class="setup-footer tiny">CHANGES SAVE AUTOMATICALLY · READY WHEN YOU ARE</p></div></div>`;
}
function collection(shop) {
  return garageView(profile, cars, shop, garageFilter, {
    heading,
    i,
    escape,
    carArt,
  });
}
function updateGarage() {
  const list = garageList(profile, cars, page === "shop", garageFilter);
  $(".cars-grid").innerHTML = garageCards(profile, list, { i, carArt, escape });
  $(".garage-pagination").innerHTML = garagePagination(list, garageFilter);
  $("#car-count").textContent = `${list.total} cars`;
  iconify();
}
function tracksPage() {
  return `${heading("FROM THE CLUB. FROM YOUR IMAGINATION.", "A world of <em>possibilities.</em>", "Choose a preset or race a circuit you built yourself.", `<button class="orange-btn" data-page="builder">${i("Plus")} Build a track</button>`)}<div class="tracks-grid">${allTracks()
    .map(
      (t, j) =>
        `<article class="large-track"><div>${trackSvg(t)}</div><span class="eyebrow">${j < presets.length ? "CLUB ORIGINAL" : "YOUR CREATION"}</span><h2>${escape(t.name)}</h2><p>${escape(t.description || "Your custom club circuit.")}</p><button class="outline-btn wide" data-track-race="${j}">Race this circuit ${i("ArrowRight")}</button></article>`,
    )
    .join("")}</div>`;
}
function settings() {
  return `${heading("MAKE YOURSELF AT HOME", "Your club. <em>Your setup.</em>", "Display preferences, local saves, and everything you need to get racing.")}<div class="settings-grid"><section class="settings-card"><h2>Game settings</h2><label>Appearance<select id="theme-select">${["dark", "light", "system"].map((v) => `<option value="${v}" ${profile.settings.theme === v ? "selected" : ""}>${{ dark: "Night paddock", light: "Classic cream", system: "Follow device" }[v]}</option>`).join("")}</select></label><label>Graphics quality<select id="quality-select">${[
    ["auto", "Adaptive (recommended)"],
    ["high", "High · full resolution"],
    ["low", "Performance · reduced shadows"],
  ]
    .map(
      ([v, l]) =>
        `<option value="${v}" ${profile.settings.quality === v ? "selected" : ""}>${l}</option>`,
    )
    .join(
      "",
    )}</select></label><label class="toggle-row">Engine sound<input type="checkbox" id="sound-toggle" ${profile.settings.sound ? "checked" : ""}></label><h3>Browser storage</h3><p>Your garage, custom tracks, best laps, and settings save automatically on this device.</p><button class="outline-btn" data-action="export">${i("Download")} Export save backup</button><label class="outline-btn import-label">${i("Upload")} Import backup<input type="file" id="import-save" accept="application/json" hidden></label></section><section class="settings-card"><h2>Master the trigger</h2>${[
    ["W / ↑ / Space", "Accelerate"],
    ["S / ↓", "Brake"],
    ["C", "Cycle camera"],
    ["R", "Re-slot after repairs"],
    ["B", "Three-second pit break"],
    ["Esc / P", "Pause / resume"],
  ]
    .map(
      ([k, v]) =>
        `<div class="control-row"><kbd>${k}</kbd><span>${v}</span></div>`,
    )
    .join(
      "",
    )}<p>On touch screens, hold the orange trigger to accelerate or use the analogue slider to set precise power. Release before tight corners. The crew returns your car after a short repair countdown. Tap PIT for a three-second break; your rival keeps racing.</p><div class="tip">${i("Gauge")} Lateral force grows with the square of speed. A little less throttle can make all the difference.</div></section></div>`;
}
function editorPage() {
  if (!editor)
    editor = {
      ...structuredClone(track()),
      name: "My custom circuit",
      selected: 0,
      history: [],
    };
  return `${heading("IMAGINATION, ASSEMBLED.", "Welcome to <em>track studio.</em>", "Shape your circuit, then clip in crossovers, jumps and full vertical loops.")}<div class="editor-layout"><section class="editor-canvas"><div class="editor-toolbar"><span class="tiny">TOP VIEW / DRAG TO EDIT</span><button class="text-btn" data-action="undo">${i("Undo2")} Undo</button></div><svg id="editor-svg" viewBox="-22 -14 44 28" aria-label="Track layout editor"></svg><div class="editor-bottom"><span><span class="live-dot"></span> CLOSED LOOP</span><span id="piece-count"></span></div></section><section class="editor-panel"><label>Track name<input id="track-name" maxlength="40" value="${escape(editor.name)}"></label><label>Start from a preset<select id="editor-preset"><option value="">Choose a circuit…</option>${presets.map((t, j) => `<option value="${j}">${t.name}</option>`).join("")}</select></label><h3>Piece library</h3><p class="muted small">Sections insert after the selected orange handle. Stunts need clear space; adjust their lap position below.</p><div class="piece-grid">${[
    ["straight", "MoveHorizontal", "Straight"],
    ["curve", "CornerUpRight", "Curve"],
    ["chicane", "Spline", "Chicane"],
    ["bridge", "Landmark", "Bridge"],
    ["crossover", "Shuffle", "Crossover"],
    ["intersection", "Plus", "Intersection"],
    ["jump", "MoveUpRight", "Jump"],
    ["loop", "RotateCw", "Loop"],
  ]
    .map(
      ([a, ic, l]) =>
        `<button class="piece" data-piece="${a}">${i(ic)}${l}</button>`,
    )
    .join(
      "",
    )}</div><div class="stunt-list">${(editor.features || []).map((f, j) => `<div><span>${pieceNames[f.type]}</span><label>Position <input data-feature-position="${j}" aria-label="${pieceNames[f.type]} position" type="number" min="3" max="97" value="${Math.round(f.at * 100)}">%</label><button class="text-btn" data-remove-feature="${j}" aria-label="Remove ${pieceNames[f.type]}">×</button></div>`).join("")}</div><label class="toggle-row">Track borders<input id="border-toggle" type="checkbox" ${editor.borders !== false ? "checked" : ""}></label><label class="toggle-row">Raised bridge<input id="bridge-toggle" type="checkbox" ${editor.bridge ? "checked" : ""}></label><button class="text-btn danger" data-action="remove-point">${i("Trash2")} Remove selected section</button><div class="tip">${i("Info")} Keep room between sections. Yellow markers show stunt pieces. Test-drive after reshaping: jumps need speed control, loops need momentum and downforce.</div><button class="orange-btn wide" data-action="save-track">${i("Save")} Save circuit</button><button class="outline-btn wide" data-action="test-track">${i("Flag")} Save & test drive</button></section></div>`;
}
function drawEditor() {
  let svg = $("#editor-svg");
  if (!svg) return;
  let curve = buildCircuit(editor).curve;
  let d =
    curve
      .getPoints(250)
      .map((p, j) => `${j ? "L" : "M"}${p.x} ${p.z}`)
      .join(" ") + "Z";
  svg.innerHTML = `<defs><pattern id="grid" width="1" height="1" patternUnits="userSpaceOnUse"><circle cx="0" cy="0" r=".035" fill="#879084"/></pattern></defs><rect x="-22" y="-14" width="44" height="28" fill="url(#grid)"/><path d="${d}" fill="none" stroke="${editor.borders === false ? "#b6b8ab" : "#e7b797"}" stroke-width="3.05"/><path d="${d}" fill="none" stroke="#35413b" stroke-width="2.4"/><path d="${d}" fill="none" stroke="#ced0bf" stroke-width=".05" stroke-dasharray=".3 .25"/>${editor.points.map((p, j) => `<circle data-handle="${j}" cx="${p[0]}" cy="${p[1]}" r="${editor.selected === j ? 0.48 : 0.32}" fill="${editor.selected === j ? "#ff6136" : "#f2eedf"}" stroke="#e55e35" stroke-width=".12"/>`).join("")}${editor.bridge ? `<text x="${editor.points[2][0]}" y="${editor.points[2][1] - 1}" text-anchor="middle" font-size=".7" fill="#df5d32">BRIDGE</text>` : ""}`;
  for (const f of editor.features || []) {
    const p = baseCurve(editor).getPointAt(f.at);
    svg.insertAdjacentHTML(
      "beforeend",
      `<g pointer-events="none"><circle cx="${p.x}" cy="${p.z}" r=".65" fill="#f6c644" stroke="#182c28" stroke-width=".12"/><text x="${p.x}" y="${p.z + 0.22}" text-anchor="middle" font-size=".65" fill="#182c28">${{ loop: "↻", jump: "↗", crossover: "×", intersection: "+" }[f.type]}</text></g>`,
    );
  }
  $("#piece-count").textContent =
    `${editor.points.length} SECTIONS / ${Math.round(curve.getLength())}m`;
}
function render() {
  sceneEl.remove();
  let content = $("#content");
  content.className = page === "playing" ? "playing" : "";
  document.body.classList.toggle("in-race", page === "playing");
  $("#page-label").textContent = {
    home: "Overview",
    race: "Go racing",
    builder: "Track studio",
    garage: "My garage",
    shop: "Car shop",
    settings: "Settings",
    tracks: "Circuits",
    stats: "Driver stats",
    playing: "Race live",
  }[page].toUpperCase();
  document
    .querySelectorAll(".nav-item[data-page]")
    .forEach((n) => n.classList.toggle("active", n.dataset.page === page));
  content.innerHTML =
    page === "stats"
      ? statsView(profile, allTracks(), cars, { heading, escape, formatTime })
      : page === "home"
        ? home()
        : page === "race"
          ? setup()
          : page === "builder"
            ? editorPage()
            : page === "garage" || page === "shop"
              ? collection(page === "shop")
              : page === "tracks"
                ? tracksPage()
                : page === "settings"
                  ? settings()
                  : raceUI();
  $("#scene-mount")?.append(sceneEl);
  iconify();
  if (page === "builder") drawEditor();
  if (world && world.vehicles[1]) {
    world.vehicles[1].visible = !(page === "playing" && raceType !== "race");
    world.resize();
  }
  window.scrollTo(0, 0);
}
function navigate(p) {
  if (state.starting) {
    state.starting = false;
    $("#loading-grid")?.remove();
  }
  if (state.racing) {
    recordSession(profile.stats, statContext, state, "Exited");
    persist();
    state.racing = false;
    held = false;
    manualThrottle = 0;
    stopAudio();
  }
  page = p;
  if (p === "home" || p === "race")
    world?.setCars(car(), cars[car().id === "aston" ? 0 : 4]);
  paused = false;
  $("#modal-root").innerHTML = "";
  render();
}
function selectTrack(j) {
  selectedTrack = j;
  profile.lastTrack = j;
  persist();
  world?.build(track());
  state.progress = 0;
  state.ai = 0.03;
}
function raceUI() {
  return `<div id="race-stage"><div id="scene-mount"></div><div class="race-top"><button class="race-icon" data-action="pause" aria-label="Pause race">${i("Pause")}</button><div class="race-title"><span>${raceType === "race" ? "GRAND PRIX" : raceType === "time" ? "TIME TRIAL" : "FREE RUN"}</span><strong>${escape(track().name)}</strong></div><div class="race-clock"><span>SESSION</span><strong id="race-time">00:00.00</strong></div></div><div class="race-left"><div class="race-position"><span>${raceType === "race" ? "POSITION" : "LAPS"}</span><strong id="position">1<small>/ 2</small></strong></div><div class="lap-stat"><span>LAP</span><strong id="lap">1 / ${lapTarget}</strong></div><div class="lap-stat"><span>BEST LAP</span><strong id="best-lap">—</strong></div></div><div class="race-map">${trackSvg(track()).replace("</svg>", '<circle id="player-map-dot" r="3.5" fill="#ff693c" stroke="#fff" stroke-width="1"/></svg>')}</div><div id="race-message" aria-live="polite" data-mode="${state.countdown > 0 ? Math.ceil(state.countdown) : ""}">${state.countdown > 0 ? `<div class="countdown">${Math.ceil(state.countdown)}</div><span>GET READY</span>` : ""}</div><div class="race-bottom"><div class="race-camera"><button data-action="camera">${i("Video")} <span id="camera-label">${state.cam}</span> <kbd>C</kbd></button><button data-action="reset">${i("RotateCcw")} Reset <kbd>R</kbd></button><button data-action="pit">${i("Wrench")} Pit <kbd>B</kbd></button></div><div class="speedometer"><strong id="speed">0</strong><span>KM/H <b>1:32</b></span><div class="load-meter"><span id="load-fill"></span></div><small id="grip-label">GRIP AVAILABLE</small></div><div class="controller"><div class="controller-label"><span>THROTTLE</span><b id="power-label">0%</b></div><input id="throttle" aria-label="Analogue throttle" type="range" min="0" max="100" value="0"><div class="trigger-row"><button id="brake-button">BRAKE</button><button id="trigger">${i("Zap")} HOLD TO GO</button></div></div></div></div>`;
}
function formatTime(s) {
  if (!Number.isFinite(s)) return "—";
  let m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${(s % 60).toFixed(2).padStart(5, "0")}`;
}
let audioContext, osc, gain;
function startAudio() {
  if (!profile.settings.sound) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    audioContext.resume();
    if (!osc) {
      osc = audioContext.createOscillator();
      gain = audioContext.createGain();
      osc.type = "sawtooth";
      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.start();
    }
  } catch {}
}
function stopAudio() {
  if (gain) gain.gain.setTargetAtTime(0, audioContext.currentTime, 0.08);
}
async function start() {
  if (state.starting) return;
  const request = Symbol();
  state.startRequest = request;
  state.starting = true;
  $("#modal-root").innerHTML =
    `<div class="modal-backdrop" id="loading-grid"><section class="loading-card" role="dialog" aria-modal="true" aria-label="Preparing race"><span class="brand-mark">s<span>c</span></span><span class="eyebrow">RACE CONTROL / PREPARING GRID</span><h2>Almost lights out.</h2><p>${escape(car().name)}<br>${escape(track().name)}</p><div class="loading-line"></div><small role="status">Loading car detail & warming up graphics…</small><button class="text-btn" data-page="race">Back to race setup</button></section></div>`;
  $("#loading-grid button")?.focus();
  const startButton = document.querySelector('[data-action="start"]');
  if (startButton) {
    startButton.disabled = true;
    startButton.textContent = "Loading your car…";
  }
  startAudio();
  try {
    if (!world) throw new Error("WebGL unavailable");
    await world.setCars(car(), cars[car().id === "aston" ? 0 : 4]);
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    await world.prepare();
    if (state.startRequest !== request || !state.starting) return;
    world.draw(
      {
        ...state,
        racing: true,
        progress: 0,
        ai: 0,
        off: 0,
        cam: mode === "slot" ? "Tabletop" : "Chase",
        opponent: raceType === "race",
      },
      0,
      0,
    );
    await new Promise((resolve) => requestAnimationFrame(resolve));
  } catch {
    if (state.startRequest !== request || !state.starting) return;
    state.starting = false;
    $("#loading-grid")?.remove();
    if (startButton) {
      startButton.disabled = false;
      startButton.textContent = "Retry starting grid";
    }
    toast(
      "Car download failed. Check your connection and select the car again.",
    );
    return;
  }
  if (state.startRequest !== request || !state.starting) return;
  state.starting = false;
  $("#loading-grid")?.remove();
  if (page !== "race" && page !== "playing") return;
  profile.racePrefs = { mode, type: raceType, laps: lapTarget };
  persist();
  if (!world) {
    toast("A WebGL-capable browser is needed to race.");
    return;
  }
  state = {
    ...state,
    racing: true,
    logged: false,
    lapCrashes: 0,
    opponent: raceType === "race",
    progress: 0,
    ai: 0,
    speed: 0,
    aiSpeed: 0,
    off: 0,
    aiOff: 0,
    aiRepair: 0,
    repair: 0,
    flight: null,
    aiFlight: null,
    crashReason: "",
    returnProgress: undefined,
    aiReturn: undefined,
    slip: 0,
    recovery: 1.2,
    time: 0,
    lapTime: 0,
    best: Infinity,
    countdown: 3,
    load: 0,
    crashes: 0,
    finished: false,
    cam: mode === "slot" ? "Tabletop" : "Chase",
  };
  held = false;
  manualThrottle = 0;
  brake = false;
  paused = false;
  lastStatSave = 0;
  statContext = {
    trackId: circuitKey(track()),
    track: track().name,
    car: car().id,
    mode: raceType,
  };
  addStats(profile.stats, statContext, { starts: 1 });
  persist();
  page = "playing";
  render();
  startAudio();
}
function resetCar() {
  if (!state.racing || state.finished) return;
  if (
    !state.off &&
    (state.flight || featureAt(world.features, state.progress)?.type === "loop")
  ) {
    toast("Finish the stunt before stopping for the crew.");
    return;
  }
  if (state.off && state.repair > 0) {
    toast(`Pit crew working · ${state.repair.toFixed(1)}s remaining`);
    return;
  }
  if (state.off && state.crashReason !== "pit") {
    addStats(profile.stats, statContext, { reslots: 1 });
    queueSave();
  }
  if (state.returnProgress !== undefined) state.progress = state.returnProgress;
  state.returnProgress = undefined;
  state.flight = null;
  state.repair = 0;
  resetHandling(state);
  held = false;
  brake = false;
  manualThrottle = 0;
  if ($("#throttle")) $("#throttle").value = 0;
  if ($("#race-message")) {
    $("#race-message").innerHTML = "";
    $("#race-message").dataset.mode = "";
  }
  world?.draw(state, 0, 0);
}
function crashCar(reason, feature = null) {
  if (state.off || state.finished) return;
  if (
    reason === "pit" &&
    (state.flight ||
      ["loop", "jump"].includes(
        featureAt(world.features, state.progress)?.type,
      ))
  ) {
    toast("Finish the stunt before taking a pit break.");
    return;
  }
  state.off = 0.01;
  state.repair = repairSeconds(reason);
  state.crashReason = reason;
  state.flight = null;
  state.fly.copy(world.curve.getTangentAt(state.progress % 1));
  if (feature && ["jump", "loop"].includes(reason))
    state.returnProgress =
      Math.floor(state.progress) +
      Math.max(0.01, feature.start - 12 / world.length);
  if (reason !== "pit") {
    state.crashes++;
    state.lapCrashes++;
    addStats(profile.stats, statContext, { crashes: 1 });
  }
  addStats(profile.stats, statContext, {
    pitStops: 1,
    ...(reason === "collision" ? { collisions: 1 } : {}),
  });
  queueSave();
  held = false;
  brake = false;
  manualThrottle = 0;
  if ($("#throttle")) $("#throttle").value = 0;
}
function modal(title, body, buttons) {
  $("#modal-root").innerHTML =
    `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-label="${title}"><div class="eyebrow">SLOT CLUB / RACE CONTROL</div><h2>${title}</h2>${body}<div class="modal-actions">${buttons}</div></section></div>`;
  iconify();
  $("#modal-root button")?.focus();
}
function pause() {
  if (!state.racing || state.finished) return;
  paused = !paused;
  if ($("#throttle")) $("#throttle").value = 0;
  held = false;
  brake = false;
  manualThrottle = 0;
  stopAudio();
  if (paused)
    modal(
      "Take a pit stop.",
      `<p>Your race is paused. Ready when you are.</p>`,
      `<button class="orange-btn" data-action="pause">Resume race ${i("Play")}</button><button class="outline-btn" data-page="race">Exit to paddock</button>`,
    );
  else {
    $("#modal-root").innerHTML = "";
    startAudio();
  }
}
function finish(aiWon = false) {
  if (state.finished) return;
  recordSession(
    profile.stats,
    statContext,
    state,
    raceType === "race" ? (aiWon ? "Runner-up" : "Won") : "Completed",
  );
  state.finished = true;
  held = false;
  manualThrottle = 0;
  stopAudio();
  profile.races++;
  const key = personalBestKey();
  if (
    Number.isFinite(state.best) &&
    (!profile.records[key] || state.best < profile.records[key])
  )
    profile.records[key] = state.best;
  persist();
  modal(
    aiWon
      ? "A race worth chasing."
      : raceType === "race"
        ? "First to the flag."
        : "That’s a wrap.",
    `<p>${aiWon ? "Your rival took the win. Find a little more rhythm next time." : raceType === "race" ? "You kept your nerve and brought it home." : "Your session has been saved. Every lap makes you better."}</p><div class="result-stats"><div><small>TOTAL TIME</small><strong>${formatTime(state.time)}</strong></div><div><small>BEST LAP</small><strong>${formatTime(state.best)}</strong></div><div><small>DESLOTS</small><strong>${state.crashes}</strong></div></div>`,
    `<button class="orange-btn" data-action="again">Race again ${i("RotateCcw")}</button><button class="outline-btn" data-page="home">Back to club</button>`,
  );
}
function pushHistory() {
  editor.history.push(
    JSON.stringify({
      points: editor.points,
      bridge: editor.bridge,
      borders: editor.borders,
      heights: editor.heights,
      features: editor.features || [],
    }),
  );
  if (editor.history.length > 40) editor.history.shift();
}
function saveTrack(test = false) {
  editor.name = $("#track-name").value.trim() || "My custom circuit";
  if (
    editor.points.some(
      (p, j) =>
        Math.hypot(
          p[0] - editor.points[(j + 1) % editor.points.length][0],
          p[1] - editor.points[(j + 1) % editor.points.length][1],
        ) < 1.8,
    )
  ) {
    toast("Give neighbouring handles at least 1.8m of space.");
    return;
  }
  if (!validFeatures(editor)) {
    toast(
      "Stunt pieces overlap or sit too close to the start. Move or remove a piece first.",
    );
    return;
  }
  const t = {
    name: editor.name,
    points: structuredClone(editor.points),
    bridge: editor.bridge,
    borders: editor.borders,
    theme: editor.theme,
    heights: editor.heights,
    features: structuredClone(editor.features || []),
    description: "Designed in your track studio. Ready for the starting grid.",
    difficulty: "Custom",
    id: editor.id || crypto.randomUUID(),
  };
  let existing = profile.tracks.findIndex((x) => x.id === t.id);
  if (existing < 0) {
    profile.tracks.push(t);
    existing = profile.tracks.length - 1;
  } else profile.tracks[existing] = t;
  editor.id = t.id;
  selectTrack(presets.length + existing);
  toast("Circuit saved to this browser.");
  if (test) {
    raceType = "practice";
    navigate("race");
  }
}
document.addEventListener("click", (e) => {
  if (e.target.closest(".brand")) {
    e.preventDefault();
    navigate("home");
    return;
  }
  let el = e.target.closest("button");
  if (!el) return;
  if (el.dataset.action === "theme") {
    profile.settings.theme =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme();
    persist();
    return;
  }
  if (el.dataset.action === "quick-start") {
    navigate("race");
    start();
    return;
  }
  if (el.dataset.garageStep) {
    garageFilter.page += +el.dataset.garageStep;
    updateGarage();
    $(".garage-tools").scrollIntoView({ block: "start" });
    return;
  }
  if (el.dataset.page) {
    navigate(el.dataset.page);
    return;
  }
  if (el.dataset.track !== undefined) {
    selectTrack(+el.dataset.track);
    render();
    return;
  }
  if (el.dataset.trackRace !== undefined) {
    selectTrack(+el.dataset.trackRace);
    navigate("race");
    return;
  }
  if (el.dataset.mode) {
    mode = el.dataset.mode;
    profile.racePrefs.mode = mode;
    persist();
    render();
    return;
  }
  if (el.dataset.raceType) {
    raceType = el.dataset.raceType;
    profile.racePrefs.type = raceType;
    persist();
    render();
    return;
  }
  if (el.dataset.car) {
    let c = cars.find((c) => c.id === el.dataset.car);
    const result = purchaseCar(profile, c);
    if (!result.ok) {
      toast("Not enough club credits for this car.");
      return;
    }
    if (result.purchased)
      toast(`${c.name} added to your garage · ${c.price.toLocaleString()} CR.`);
    persist();
    // Collection pages use thumbnails; fetch geometry only when a 3D view needs it.
    const previousScroll = scrollY;
    render();
    window.scrollTo(0, previousScroll);
    return;
  }
  if (el.dataset.removeFeature !== undefined) {
    pushHistory();
    editor.features.splice(+el.dataset.removeFeature, 1);
    render();
    return;
  }
  if (el.dataset.piece && pieceNames[el.dataset.piece]) {
    const curve = baseCurve(editor),
      p = editor.points[editor.selected];
    let nearest = 0,
      distance = Infinity;
    for (let j = 0; j < 1000; j++) {
      const q = curve.getPointAt(j / 1000),
        d = Math.hypot(q.x - p[0], q.z - p[1]);
      if (d < distance) {
        distance = d;
        nearest = j / 1000;
      }
    }
    const f = {
      type: el.dataset.piece,
      at: Math.min(
        0.88,
        Math.max(
          0.1,
          nearest + pieceSpan[el.dataset.piece] / curve.getLength() / 2 + 0.025,
        ),
      ),
    };
    const features = [...(editor.features || []), f];
    if (!validFeatures({ ...editor, features })) {
      toast(
        "No clear space here. Choose another handle or move an existing stunt piece.",
      );
      return;
    }
    pushHistory();
    editor.features = features;
    render();
    return;
  }
  if (el.dataset.piece) {
    if (editor.points.length >= 40) {
      toast("Maximum 40 control sections per circuit.");
      return;
    }
    pushHistory();
    let j = editor.selected,
      a = editor.points[j],
      b = editor.points[(j + 1) % editor.points.length],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      len = Math.hypot(dx, dz) || 1;
    let piece = el.dataset.piece;
    if (piece === "bridge") {
      editor.bridge = true;
      editor.selected = 2;
      $("#bridge-toggle").checked = true;
    } else {
      let off = piece === "curve" ? 2 : piece === "chicane" ? -2 : 0;
      editor.points.splice(j + 1, 0, [
        (a[0] + b[0]) / 2 - (dz / len) * off,
        (a[1] + b[1]) / 2 + (dx / len) * off,
      ]);
      if (editor.heights)
        editor.heights.splice(
          j + 1,
          0,
          ((editor.heights[j] || 0) +
            (editor.heights[(j + 1) % editor.heights.length] || 0)) /
            2,
        );
      editor.selected = j + 1;
    }
    drawEditor();
    return;
  }
  switch (el.dataset.action) {
    case "pit":
      if (state.racing && !paused && !state.finished && state.countdown <= 0)
        crashCar("pit");
      break;
    case "next-track":
      selectTrack((selectedTrack + 1) % allTracks().length);
      render();
      break;
    case "start":
    case "again":
      $("#modal-root").innerHTML = "";
      start();
      break;
    case "pause":
      pause();
      break;
    case "reset":
      resetCar();
      break;
    case "camera": {
      let cams = ["Tabletop", "Chase", "Cockpit", "Bumper"];
      state.cam = cams[(cams.indexOf(state.cam) + 1) % cams.length];
      $("#camera-label").textContent = state.cam;
      break;
    }
    case "help":
      modal(
        "A little throttle. A lot of feeling.",
        `<p>Pick a circuit and a car, then choose Classic slot or a driver camera. Hold <kbd>W</kbd>, <kbd>↑</kbd> or <kbd>Space</kbd> to accelerate. Release before bends, or use <kbd>S</kbd> to brake.</p><p>Too fast in a corner? Your car flies off. The pit crew repairs and re-slots it after a short countdown. Use <kbd>B</kbd> for a three-second pit break. Jumps reward controlled takeoff speed; keep power on through vertical loops. Crossovers and intersections share space with your rival. On mobile, use the on-screen trigger and throttle slider.</p>`,
        `<button class="orange-btn" data-action="close">Got it ${i("ArrowRight")}</button>`,
      );
      break;
    case "close":
      $("#modal-root").innerHTML = "";
      break;
    case "undo":
      if (editor.history.length) {
        Object.assign(editor, JSON.parse(editor.history.pop()));
        editor.selected = Math.min(editor.selected, editor.points.length - 1);
        render();
      }
      break;
    case "remove-point":
      if (editor.points.length <= 4)
        toast("A circuit needs at least four sections.");
      else {
        pushHistory();
        editor.points.splice(editor.selected, 1);
        editor.heights?.splice(editor.selected, 1);
        editor.selected = 0;
        drawEditor();
      }
      break;
    case "save-track":
      saveTrack();
      break;
    case "test-track":
      saveTrack(true);
      break;
    case "export": {
      const blob = new Blob(
        [JSON.stringify({ ...profile, version: 1 }, null, 2)],
        { type: "application/json" },
      );
      const url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = "slot-club-save.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast("Save backup exported.");
      break;
    }
  }
});
document.addEventListener("change", async (e) => {
  let el = e.target;
  if (el.dataset.featurePosition !== undefined) {
    const j = +el.dataset.featurePosition,
      features = structuredClone(editor.features);
    features[j].at = Number(el.value) / 100;
    if (!validFeatures({ ...editor, features })) {
      toast("Leave room between stunt pieces and the starting line.");
      render();
      return;
    }
    pushHistory();
    editor.features = features;
    drawEditor();
    return;
  }
  switch (el.id) {
    case "track-select":
      selectTrack(+el.value);
      render();
      break;
    case "lap-select":
      lapTarget = +el.value;
      profile.racePrefs.laps = lapTarget;
      persist();
      render();
      break;
    case "car-select":
      profile.selected = el.value;
      persist();
      world?.setCars(car(), cars[4]);
      render();
      break;
    case "editor-preset":
      if (el.value !== "") {
        editor = {
          ...structuredClone(presets[+el.value]),
          name: "My custom circuit",
          selected: 0,
          history: [],
        };
        render();
      }
      break;
    case "track-name":
      editor.name = el.value;
      break;
    case "border-toggle":
    case "bridge-toggle":
      pushHistory();
      editor[el.id === "border-toggle" ? "borders" : "bridge"] = el.checked;
      drawEditor();
      break;
    case "car-era":
      garageFilter.era = el.value;
      garageFilter.page = 0;
      updateGarage();
      break;
    case "car-tier":
      garageFilter.tier = el.value;
      garageFilter.page = 0;
      updateGarage();
      break;
    case "car-sort":
      garageFilter.sort = el.value;
      garageFilter.page = 0;
      updateGarage();
      break;
    case "theme-select":
      profile.settings.theme = el.value;
      applyTheme();
      persist();
      break;
    case "quality-select":
      profile.settings.quality = el.value;
      persist();
      applyQuality();
      break;
    case "sound-toggle":
      profile.settings.sound = el.checked;
      persist();
      break;
    case "import-save":
      try {
        let file = el.files[0];
        if (!file || file.size > 1e6) throw Error();
        let p = JSON.parse(await file.text());
        if (
          p.version !== 1 ||
          !Array.isArray(p.owned) ||
          !Array.isArray(p.tracks) ||
          !p.tracks.every(validTrack)
        )
          throw Error();
        profile = normalize(p);
        applyTheme();
        mode = profile.racePrefs.mode;
        raceType = profile.racePrefs.type;
        lapTarget = profile.racePrefs.laps;
        selectedTrack = 0;
        persist();
        world?.build(track());
        world?.setCars(car(), cars[4]);
        applyQuality();
        render();
        toast("Save backup restored.");
      } catch {
        toast("This file is not a valid Slot Club save backup.");
      }
      break;
  }
});
document.addEventListener("input", (e) => {
  if (e.target.id === "car-search") {
    garageFilter.query = e.target.value;
    garageFilter.page = 0;
    updateGarage();
  }
  if (e.target.id === "throttle") manualThrottle = +e.target.value / 100;
});
let drag = null;
document.addEventListener("pointerdown", (e) => {
  if (e.target.closest("#trigger")) {
    e.preventDefault();
    held = true;
    e.target.closest("button").setPointerCapture(e.pointerId);
  }
  if (e.target.closest("#brake-button")) {
    e.preventDefault();
    brake = true;
    e.target.closest("button").setPointerCapture(e.pointerId);
  }
  let handle = e.target.closest("[data-handle]");
  if (handle) {
    pushHistory();
    editor.selected = +handle.dataset.handle;
    drag = e.pointerId;
    $("#editor-svg").setPointerCapture(e.pointerId);
    drawEditor();
  }
});
document.addEventListener("pointermove", (e) => {
  if (drag !== e.pointerId || !editor) return;
  let svg = $("#editor-svg");
  if (!svg) return;
  let p = new DOMPoint(e.clientX, e.clientY).matrixTransform(
    svg.getScreenCTM().inverse(),
  );
  editor.points[editor.selected] = [
    Math.max(-19, Math.min(19, Math.round(p.x * 2) / 2)),
    Math.max(-11, Math.min(11, Math.round(p.y * 2) / 2)),
  ];
  drawEditor();
});
function release() {
  held = false;
  brake = false;
  drag = null;
}
document.addEventListener("pointerup", release);
document.addEventListener("pointercancel", release);
document.addEventListener("keydown", (e) => {
  if (state.starting) {
    if (e.key === "Escape") navigate("race");
    if (e.key === "Tab") {
      e.preventDefault();
      $("#loading-grid button")?.focus();
    }
    return;
  }
  if (e.target.matches("input:not([type=range]),select,textarea")) return;
  if (!state.racing) return;
  let key = e.key.toLowerCase();
  if ([" ", "arrowup", "arrowdown"].includes(key)) e.preventDefault();
  if (["escape", "p"].includes(key) && !e.repeat) {
    pause();
    return;
  }
  if (paused || state.finished) return;
  if (["w", "arrowup", " "].includes(key)) held = true;
  if (["s", "arrowdown"].includes(key)) brake = true;
  if (key === "r") resetCar();
  if (key === "b" && !e.repeat && state.countdown <= 0) crashCar("pit");
  if (key === "c" && !e.repeat)
    document.querySelector('[data-action="camera"]')?.click();
});
document.addEventListener("keyup", (e) => {
  if (["w", "arrowup", " "].includes(e.key.toLowerCase())) held = false;
  if (["s", "arrowdown"].includes(e.key.toLowerCase())) brake = false;
});
window.addEventListener("blur", () => {
  release();
  manualThrottle = 0;
  if (state.racing && !paused && !state.finished) pause();
});
window.addEventListener("pagehide", () => {
  if (state.racing && statContext)
    recordSession(profile.stats, statContext, state, "Exited");
  persist();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    release();
    if (state.racing && !paused && !state.finished) pause();
    persist();
  }
  last = performance.now();
});
function applyQuality() {
  if (!world) return;
  const low = profile.settings.quality !== "high";
  const detailChanged = world.lowDetail !== low;
  world.lowDetail = low;
  if (detailChanged) world.setCars(car(), cars[car().id === "aston" ? 0 : 4]);
  world.renderer.setPixelRatio(
    profile.settings.quality === "high"
      ? Math.min(devicePixelRatio, 1.5)
      : Math.min(devicePixelRatio, 1.25),
  );
  world.renderer.shadowMap.enabled = profile.settings.quality !== "low";
  world.renderer.shadowMap.needsUpdate = true;

  world.resize();
}
let last = performance.now(),
  time = 0,
  hudTime = 0,
  frameAverage = 16,
  qualityReduced = false;
function advanceSimulation(dt) {
  if (state.racing && !paused && !state.finished) {
    if (state.countdown > 0) state.countdown -= dt;
    else {
      state.time += dt;
      state.lapTime += dt;
      addStats(profile.stats, statContext, {
        seconds: dt,
        throttleSeconds: !state.off && (held || manualThrottle > 0) ? dt : 0,
        brakeSeconds: brake ? dt : 0,
      });
      if (state.time - lastStatSave > 15) {
        lastStatSave = state.time;
        queueSave();
      }
      const throttle = held ? 1 : manualThrottle;
      if (state.off > 0) {
        state.off += dt;
        state.repair = Math.max(0, state.repair - dt);
        addStats(profile.stats, statContext, { pitSeconds: dt });
        state.speed = 0;
        if (state.repair === 0) resetCar();
      } else {
        if (!state.flight)
          state.speed = stepSpeed(state.speed, throttle, brake, dt, car());
        let u = state.progress % 1;
        const activeFeature = featureAt(world.features, u);
        const curvature =
          activeFeature?.type === "loop" || state.flight
            ? 0
            : sampleCurvature(world.curve, world.length, u);
        state.load = cornerLoad(state.speed, curvature, car().grip);
        state.recovery = Math.max(0, state.recovery - dt);
        state.slip =
          state.recovery > 0 ? 0 : stepGrip(state.load, state.slip, dt);
        if (state.slip > car().stability && state.speed > 8) {
          crashCar("corner");
        } else {
          const previousProgress = state.progress;
          let prev = Math.floor(state.progress);
          state.progress += (state.speed * dt) / world.length;
          const event = advanceStunt(state, world, car(), previousProgress, dt);
          if (event === "jump" || event === "loop")
            crashCar(event, featureAt(world.features, state.progress));
          if (event === "takeoff")
            addStats(profile.stats, statContext, { jumps: 1 });
          if (event === "landed")
            addStats(profile.stats, statContext, { landings: 1 });
          for (const f of world.features)
            if (
              f.type === "loop" &&
              previousProgress % 1 < f.end &&
              state.progress % 1 >= f.end &&
              !state.off
            )
              addStats(profile.stats, statContext, { loops: 1 });
          addStats(profile.stats, statContext, {
            distance: state.speed * dt,
            topSpeed: state.speed,
          });
          if (Math.floor(state.progress) > prev) {
            recordLap(
              profile.stats,
              statContext,
              state.lapTime,
              state.lapCrashes === 0,
            );
            state.lapCrashes = 0;
            queueSave();
            state.best = Math.min(state.best, state.lapTime);
            const recordKey = personalBestKey();
            if (
              !profile.records[recordKey] ||
              state.best < profile.records[recordKey]
            ) {
              profile.records[recordKey] = state.best;
              queueSave();
            }
            state.lapTime = 0;
            if (
              raceType !== "practice" &&
              Math.floor(state.progress) >= lapTarget
            )
              finish();
          }
        }
      }
      if (raceType === "race") {
        if (state.aiOff) {
          state.aiOff += dt;
          state.aiRepair -= dt;
          state.aiSpeed = 0;
          if (state.aiRepair <= 0) {
            state.aiOff = 0;
            state.ai = state.aiReturn ?? state.ai;
            state.aiReturn = undefined;
          }
        } else {
          const rival = cars[car().id === "aston" ? 0 : 4],
            aiU = state.ai % 1;
          const f = featureAt(world.features, aiU),
            ahead = featureAt(world.features, (aiU + 6 / world.length) % 1);
          const stunt = f || ahead;
          const ac =
            f?.type === "loop"
              ? 0
              : sampleCurvature(world.curve, world.length, aiU);
          let desired = Math.min(15, Math.sqrt(17 / Math.max(0.01, ac)));
          if (stunt?.type === "loop") desired = loopMinimum(rival) + 3;
          if (stunt?.type === "jump") {
            const w = jumpWindow(rival);
            desired = (w.min + w.max) / 2;
          }
          if (!state.aiFlight)
            state.aiSpeed = stepSpeed(
              state.aiSpeed,
              desired / rival.speed,
              false,
              dt,
              rival,
            );
          const previous = state.ai;
          state.ai += (state.aiSpeed * dt) / world.length;
          const aiState = {
            progress: state.ai,
            speed: state.aiSpeed,
            flight: state.aiFlight,
          };
          const event = advanceStunt(aiState, world, rival, previous, dt);
          state.aiFlight = aiState.flight;
          if (event === "jump" || event === "loop") {
            state.aiOff = 0.01;
            state.aiRepair = repairSeconds(event);
            state.aiFlight = null;
            const failed = featureAt(world.features, state.ai);
            state.aiReturn =
              Math.floor(state.ai) +
              Math.max(0.01, (failed?.start || 0) - 12 / world.length);
          }
          if (
            !state.off &&
            !state.aiOff &&
            !state.flight &&
            !state.aiFlight &&
            state.recovery <= 0 &&
            world.features.length &&
            collisionAt(
              world.pose(state.progress, -0.6).p,
              world.pose(state.ai, 0.6).p,
            )
          ) {
            crashCar("collision");
            state.aiOff = 0.01;
            state.aiRepair = repairSeconds("collision");
          }
        }
        if (state.ai >= lapTarget && !state.finished) finish(true);
      }
      if (gain) {
        gain.gain.setTargetAtTime(
          state.off ? 0 : 0.014 * throttle,
          audioContext.currentTime,
          0.05,
        );
        osc.frequency.setTargetAtTime(
          50 + state.speed * 13,
          audioContext.currentTime,
          0.06,
        );
      }
    }
  } else if (!state.racing) {
    state.progress += dt * 0.032;
    state.ai = state.progress + 0.08;
  }
}
function frame(now) {
  raf = requestAnimationFrame(frame);
  let elapsed = now - last;
  let dt = Math.min(elapsed / 1000, 0.5);
  last = now;
  time += dt;
  if (document.hidden || !sceneEl.isConnected || !world) return;
  // Fixed physics steps keep grip/recovery consistent even on slower frames.
  for (let remaining = dt; remaining > 1e-6; remaining -= 1 / 60)
    advanceSimulation(Math.min(remaining, 1 / 60));
  if (state.racing && now - hudTime > 70) {
    hudTime = now;
    const mapPos = world.curve.getPointAt(state.progress % 1);
    $("#player-map-dot")?.setAttribute("cx", mapPos.x * 4 + 85);
    $("#player-map-dot")?.setAttribute("cy", mapPos.z * 4 + 49);
    $("#speed").textContent = Math.round(state.speed * 7.2);
    $("#race-time").textContent = formatTime(state.time);
    $("#lap").textContent =
      raceType === "practice"
        ? Math.floor(state.progress) + 1
        : `${Math.min(lapTarget, Math.floor(state.progress) + 1)} / ${lapTarget}`;
    $("#position").innerHTML =
      raceType === "race"
        ? `${state.progress >= state.ai ? "1" : "2"}<small>/ 2</small>`
        : Math.floor(state.progress);
    $("#best-lap").textContent = formatTime(state.best);
    $("#power-label").textContent =
      `${Math.round((held ? 1 : manualThrottle) * 100)}%`;
    $("#load-fill").style.width = `${Math.min(state.load / 1.2, 1) * 100}%`;
    $("#load-fill").style.background = state.load > 0.8 ? "#ff5e36" : "#b3d298";
    $("#grip-label").textContent =
      state.load > 0.8 ? "EASE OFF · LIMIT APPROACHING" : "GRIP AVAILABLE";
    const activeStunt = featureAt(world.features, state.progress);
    if (state.flight)
      $("#grip-label").textContent = "AIRBORNE · HOLD YOUR LINE";
    else if (activeStunt?.type === "loop")
      $("#grip-label").textContent = "LOOP · KEEP YOUR MOMENTUM";
    const messageMode =
      state.countdown > 0
        ? String(Math.ceil(state.countdown))
        : state.off
          ? "off"
          : "";
    // Keep the re-slot button mounted throughout pointerdown -> pointerup.
    const message = $("#race-message");
    if (message.dataset.mode !== messageMode) {
      message.dataset.mode = messageMode;
      message.innerHTML =
        state.countdown > 0
          ? `<div class="countdown">${Math.ceil(state.countdown)}</div><span>GET READY</span>`
          : state.off
            ? `<div class="off-label">${state.crashReason === "pit" ? "PIT BREAK" : "OFF THE SLOT!"}</div><span class="repair-reason">${{ corner: "Corner overload", jump: "Missed landing", loop: "Lost loop grip", collision: "Track collision", pit: "Crew checks & a breather" }[state.crashReason] || "Recovering"}</span><strong id="repair-clock"></strong><small>Race clock running · automatic return</small><button data-action="reset">${i("Wrench")} Re-slot car <kbd>R</kbd></button>`
            : "";
      iconify();
    }
  }
  if (state.off && $("#repair-clock"))
    $("#repair-clock").textContent = `${Math.max(0, state.repair).toFixed(1)}s`;
  if (!paused) world.draw(state, dt, time);
  frameAverage = frameAverage * 0.98 + elapsed * 0.02;
  if (
    profile.settings.quality === "auto" &&
    !qualityReduced &&
    time > 6 &&
    frameAverage > 24
  ) {
    world.renderer.setPixelRatio(1);
    // Reduce fill rate without downloading or compiling another model mid-race.
    world.renderer.shadowMap.enabled = false;
    world.resize();
    qualityReduced = true;
  }
}
render();
applyQuality();
raf = requestAnimationFrame(frame);
