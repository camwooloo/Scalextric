import { validFeatures } from "./stunts.js";
import { cars, presets } from "./data.js";
import { STARTING_CREDITS } from "./economy.js";
import { normalizeStats } from "./stats.js";
const KEY = "slot-club:v1";
const defaults = {
  owned: ["porsche"],
  selected: "porsche",
  tracks: [],
  credits: STARTING_CREDITS,
  creditsSpent: 0,
  records: {},
  stats: null,
  races: 0,
  settings: { quality: "auto", sound: true, theme: "dark" },
  lastTrack: 0,
  presetCount: presets.length,
  racePrefs: { mode: "slot", type: "race", laps: 3 },
};
export function validTrack(t) {
  return (
    !!t &&
    typeof t.name === "string" &&
    t.name.length <= 40 &&
    Array.isArray(t.points) &&
    t.points.length >= 4 &&
    t.points.length <= 40 &&
    (!t.heights ||
      (Array.isArray(t.heights) &&
        t.heights.length === t.points.length &&
        t.heights.every((v) => Number.isFinite(v) && v >= 0 && v <= 5))) &&
    t.points.every(
      (p) =>
        Array.isArray(p) &&
        p.length === 2 &&
        p.every((v) => Number.isFinite(v) && Math.abs(v) <= 30),
    ) &&
    validFeatures(t)
  );
}
export function normalize(raw) {
  if (!raw || raw.version !== 1) return structuredClone(defaults);
  const owned = Array.isArray(raw.owned)
    ? raw.owned.filter((id) => cars.some((c) => c.id === id))
    : ["porsche"];
  if (!owned.length) owned.push("porsche");
  const tracks = Array.isArray(raw.tracks) ? raw.tracks.filter(validTrack) : [];
  const records = {};
  if (raw.records && typeof raw.records === "object")
    for (const [k, v] of Object.entries(raw.records)) {
      if (Number.isFinite(v) && v > 0) records[k] = v;
    }
  const prefs = raw.racePrefs || {};
  return {
    owned,
    selected: owned.includes(raw.selected) ? raw.selected : owned[0],
    tracks,
    credits:
      Number.isFinite(raw.credits) && raw.credits >= 0
        ? Math.min(1_000_000_000, Math.floor(raw.credits))
        : STARTING_CREDITS,
    creditsSpent:
      Number.isFinite(raw.creditsSpent) && raw.creditsSpent >= 0
        ? raw.creditsSpent
        : 0,
    records,
    stats: normalizeStats(raw.stats),
    races: Number.isInteger(raw.races) && raw.races >= 0 ? raw.races : 0,
    presetCount: presets.length,
    lastTrack:
      Number.isInteger(raw.lastTrack) && raw.lastTrack >= 0
        ? raw.lastTrack >= (raw.presetCount || 3)
          ? raw.lastTrack + presets.length - (raw.presetCount || 3)
          : raw.lastTrack
        : 0,
    settings: {
      theme: ["dark", "light", "system"].includes(raw.settings?.theme)
        ? raw.settings.theme
        : "dark",
      quality: ["auto", "high", "low"].includes(raw.settings?.quality)
        ? raw.settings.quality
        : "auto",
      sound:
        typeof raw.settings?.sound === "boolean" ? raw.settings.sound : true,
    },
    racePrefs: {
      mode: prefs.mode === "driver" ? "driver" : "slot",
      type: ["race", "time", "practice"].includes(prefs.type)
        ? prefs.type
        : "race",
      laps: [3, 5, 10].includes(prefs.laps) ? prefs.laps : 3,
    },
  };
}
export function load() {
  try {
    return normalize(JSON.parse(localStorage.getItem(KEY) || "null"));
  } catch {
    return structuredClone(defaults);
  }
}
export function save(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...data, version: 1 }));
    return true;
  } catch {
    return false;
  }
}
