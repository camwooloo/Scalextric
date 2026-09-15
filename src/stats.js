// Cumulative counters include partial sessions. Histories are bounded for local saves.
const fields = [
  "starts",
  "completed",
  "wins",
  "laps",
  "cleanLaps",
  "crashes",
  "reslots",
  "seconds",
  "distance",
  "throttleSeconds",
  "brakeSeconds",
  "topSpeed",
];
export const counters = () => Object.fromEntries(fields.map((k) => [k, 0]));
export function emptyStats() {
  return {
    since: Date.now(),
    ...counters(),
    tracks: {},
    cars: {},
    modes: {},
    history: [],
    lapHistory: [],
  };
}
function cleanCounters(raw = {}) {
  return Object.fromEntries(
    fields.map((k) => [k, Number.isFinite(raw[k]) && raw[k] >= 0 ? raw[k] : 0]),
  );
}
export function normalizeStats(raw) {
  const out = emptyStats();
  if (!raw || typeof raw !== "object") return out;
  Object.assign(out, cleanCounters(raw));
  if (Number.isFinite(raw.since) && raw.since > 0) out.since = raw.since;
  for (const kind of ["tracks", "cars", "modes"])
    for (const [id, value] of Object.entries(raw[kind] || {}).slice(0, 500)) {
      if (
        !value ||
        typeof value !== "object" ||
        ["__proto__", "constructor", "prototype"].includes(id)
      )
        continue;
      out[kind][id] = {
        ...cleanCounters(value),
        name: String(value.name || id).slice(0, 80),
        best: Number.isFinite(value.best) && value.best > 0 ? value.best : null,
      };
    }
  for (const kind of ["history", "lapHistory"])
    out[kind] = (Array.isArray(raw[kind]) ? raw[kind] : [])
      .filter(
        (x) =>
          x &&
          typeof x.track === "string" &&
          typeof x.car === "string" &&
          Number.isFinite(x.time) &&
          x.time >= 0 &&
          Number.isFinite(x.date),
      )
      .slice(kind === "history" ? -50 : -200)
      .map((x) => ({
        track: x.track.slice(0, 80),
        car: x.car.slice(0, 80),
        time: x.time,
        date: x.date,
        laps: Math.max(0, Math.floor(x.laps || 0)),
        crashes: Math.max(0, Math.floor(x.crashes || 0)),
        result: String(x.result || "").slice(0, 30),
      }));
  return out;
}
export function circuitKey(track) {
  let hash = 2166136261;
  for (const char of JSON.stringify([
    track.points,
    track.heights,
    !!track.bridge,
  ]))
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return "circuit-" + (hash >>> 0).toString(36);
}
export function statBuckets(stats, context) {
  return [
    stats,
    ...["tracks", "cars", "modes"].map((kind, j) => {
      const key = [context.trackId, context.car, context.mode][j];
      return (stats[kind][key] ||= {
        ...counters(),
        name: j === 0 ? context.track : key,
        best: null,
      });
    }),
  ];
}
export function addStats(stats, context, values) {
  for (const bucket of statBuckets(stats, context))
    for (const [key, value] of Object.entries(values)) {
      if (!fields.includes(key) || !Number.isFinite(value) || value < 0)
        continue;
      bucket[key] =
        key === "topSpeed" ? Math.max(bucket[key], value) : bucket[key] + value;
    }
}
export function recordLap(stats, context, time, clean) {
  addStats(stats, context, { laps: 1, cleanLaps: clean ? 1 : 0 });
  for (const b of statBuckets(stats, context))
    b.best = b.best ? Math.min(b.best, time) : time;
  stats.lapHistory.push({
    track: context.track,
    car: context.car,
    time,
    date: Date.now(),
    result: clean ? "Clean" : "Deslotted",
  });
  stats.lapHistory = stats.lapHistory.slice(-200);
}
export function recordSession(stats, context, state, result) {
  if (state.logged) return;
  state.logged = true;
  const completed = result !== "Exited";
  addStats(stats, context, {
    completed: completed ? 1 : 0,
    wins: result === "Won" ? 1 : 0,
  });
  stats.history.push({
    track: context.track,
    car: context.car,
    time: state.time,
    laps: Math.floor(state.progress),
    crashes: state.crashes,
    result,
    date: Date.now(),
  });
  stats.history = stats.history.slice(-50);
}
