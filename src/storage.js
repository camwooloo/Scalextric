import { cars } from "./data.js";
const KEY = "slot-club:v1";
const defaults = {
  owned: ["porsche"],
  selected: "porsche",
  tracks: [],
  records: {},
  races: 0,
  settings: { quality: "auto", sound: true },
  lastTrack: 0,
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
    t.points.every(
      (p) =>
        Array.isArray(p) &&
        p.length === 2 &&
        p.every((v) => Number.isFinite(v) && Math.abs(v) <= 30),
    )
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
    records,
    races: Number.isInteger(raw.races) && raw.races >= 0 ? raw.races : 0,
    lastTrack:
      Number.isInteger(raw.lastTrack) && raw.lastTrack >= 0 ? raw.lastTrack : 0,
    settings: {
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
