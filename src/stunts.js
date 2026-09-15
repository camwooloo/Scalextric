import * as THREE from "three";
export const pieceNames = {
  crossover: "Lane crossover",
  intersection: "Intersection",
  jump: "Jump ramp",
  loop: "Vertical loop",
};
export const pieceSpan = { crossover: 6, intersection: 14, jump: 9, loop: 10 };
export const wrap = (u) => ((u % 1) + 1) % 1;
export function baseCurve(config) {
  return new THREE.CatmullRomCurve3(
    config.points.map(
      (p, i) =>
        new THREE.Vector3(
          p[0],
          config.bridge ? (config.heights?.[i] ?? (i === 2 ? 3.5 : 0)) : 0,
          p[1],
        ),
    ),
    true,
    "centripetal",
  );
}
// Samples carry a transported side vector: it never flips at the top of a loop.
class CircuitCurve extends THREE.Curve {
  constructor(samples) {
    super();
    this.samples = samples;
    this.total = samples.at(-1).distance;
  }
  getLength() {
    return this.total;
  }
  getPoint(u, target = new THREE.Vector3()) {
    return this.getPointAt(u, target);
  }
  index(u) {
    const d = Math.max(0, Math.min(1, u)) * this.total;
    let lo = 0,
      hi = this.samples.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (this.samples[m].distance < d) lo = m;
      else hi = m;
    }
    return [
      lo,
      hi,
      (d - this.samples[lo].distance) /
        (this.samples[hi].distance - this.samples[lo].distance || 1),
    ];
  }
  getPointAt(u, target = new THREE.Vector3()) {
    const [a, b, t] = this.index(u);
    return target.copy(this.samples[a].p).lerp(this.samples[b].p, t);
  }
  getTangentAt(u, target = new THREE.Vector3()) {
    const d = 0.035 / this.total;
    return target
      .copy(this.getPointAt(wrap(u + d)))
      .sub(this.getPointAt(wrap(u - d)))
      .normalize();
  }
  getTangent(u, target) {
    return this.getTangentAt(u, target);
  }
  sideAt(u) {
    const [a, b, t] = this.index(u);
    return this.samples[a].side
      .clone()
      .lerp(this.samples[b].side, t)
      .normalize();
  }
}
export function buildCircuit(config) {
  const base = baseCurve(config),
    length = base.getLength();
  const pieces = (config.features || [])
    .map((f) => ({
      ...f,
      start: f.at - pieceSpan[f.type] / length / 2,
      end: f.at + pieceSpan[f.type] / length / 2,
    }))
    .filter((f) => f.start >= 0 && f.end <= 1)
    .sort((a, b) => a.start - b.start);
  if (!pieces.length) return { curve: base, features: [], length };
  const crossing = new THREE.CatmullRomCurve3(
    [
      [0, 0],
      [4, 0],
      [8, 4],
      [12, 0],
      [8, -4],
      [4, 0],
      [14, 0],
    ].map(([x, z]) => new THREE.Vector3(x, 0, z)),
    false,
    "centripetal",
  );
  const samples = [];
  let distance = 0;
  for (let i = 0; i <= 2400; i++) {
    const u = i / 2400,
      f = pieces.find((f) => u >= f.start && u <= f.end);
    let p = base.getPointAt(u),
      t = base.getTangentAt(u),
      side = new THREE.Vector3(-t.z, 0, t.x).normalize();
    if (f && (f.type === "loop" || f.type === "intersection")) {
      const a = base.getPointAt(f.start),
        b = base.getPointAt(f.end),
        forward = b.clone().sub(a).setY(0).normalize();
      side.set(-forward.z, 0, forward.x);
      const q = (u - f.start) / (f.end - f.start),
        span = Math.hypot(b.x - a.x, b.z - a.z);
      if (f.type === "loop") {
        // A circular helix separates entry and exit rails by one track width.
        // Lead-in/out sections connect it to the original control-point route.
        const c = Math.max(0, Math.min(1, (q - 0.15) / 0.7));
        let x, y, z;
        if (q < 0.15) {
          x = (3 * q) / 0.15;
          y = 0;
          z = 0;
        } else if (q > 0.85) {
          const v = (q - 0.85) / 0.15;
          x = 3.8 + (span - 3.8) * v;
          y = 0;
          z = 3.2 * (1 - v * v * (3 - 2 * v));
        } else {
          x = 3 + 0.8 * c + 3.6 * Math.sin(c * 2 * Math.PI);
          y = 3.6 * (1 - Math.cos(c * 2 * Math.PI));
          z = 3.2 * c;
        }
        p = a.clone().addScaledVector(forward, x).addScaledVector(side, z);
        p.y = a.y + (b.y - a.y) * q + y;
      } else {
        const c = crossing.getPointAt(q),
          ct = crossing.getTangentAt(q);
        p = a
          .clone()
          .lerp(b, c.x / 14)
          .addScaledVector(side, c.z);
        const tangent = forward
          .clone()
          .multiplyScalar((ct.x * span) / 14)
          .addScaledVector(side, ct.z)
          .normalize();
        side.set(-tangent.z, 0, tangent.x).normalize();
      }
    } else if (f?.type === "jump") {
      const q = (u - f.start) / (f.end - f.start);
      // Two moulded ramps separated by open air. The centre is a flight reference only.
      p.y +=
        q < 0.3
          ? 0.9 * (q / 0.3) ** 2
          : q > 0.7
            ? 0.9 * ((1 - q) / 0.3) ** 2
            : 0.9;
    }
    if (i) distance += p.distanceTo(samples.at(-1).p);
    samples.push({ p, side, distance, u });
  }
  const curve = new CircuitCurve(samples);
  const atBase = (u) =>
    samples[Math.round(Math.max(0, Math.min(1, u)) * 2400)].distance / distance;
  for (const f of pieces) {
    f.baseAt = f.at;
    const start = f.start,
      end = f.end;
    f.at = atBase(f.at);
    f.takeoff = atBase(start + (end - start) * 0.3);
    f.landing = atBase(start + (end - start) * 0.7);
    f.start = atBase(start);
    f.end = atBase(end);
    if (f.type === "crossover") f.at = (f.start + f.end) / 2;
  }
  return { curve, features: pieces, length: distance };
}
export function featureAt(features, u) {
  u = wrap(u);
  return features.find((f) => u >= f.start && u <= f.end);
}
export function laneOffset(features, progress, lane) {
  const cross = features.filter((f) => f.type === "crossover");
  let sign = (Math.floor(progress) * cross.length) % 2 === 0 ? 1 : -1;
  const u = wrap(progress);
  for (const f of cross) {
    if (u >= f.end) sign *= -1;
    else if (u > f.start)
      return (
        lane * sign * Math.cos((Math.PI * (u - f.start)) / (f.end - f.start))
      );
  }
  return lane * sign;
}
export function trackFrame(curve, u) {
  const t = curve.getTangentAt(wrap(u)),
    side =
      curve.sideAt?.(wrap(u)) || new THREE.Vector3(-t.z, 0, t.x).normalize();
  const right = side.clone().negate(),
    up = new THREE.Vector3().crossVectors(t, right).normalize();
  right.crossVectors(up, t).normalize();
  return {
    p: curve.getPointAt(wrap(u)),
    t,
    side: right.clone().negate(),
    up,
    right,
  };
}
export function jumpWindow(car) {
  return { min: 11.5 - car.jump * 0.025, max: 17 + car.jump * 0.065 };
}
export function loopMinimum(car) {
  return 15 - car.downforce * 0.065;
}
export function jumpFlight(speed, car, gap) {
  const window = jumpWindow(car),
    ideal = (window.min + window.max) / 2;
  const duration = gap / Math.max(1, speed);
  return {
    duration,
    height: Math.max(0.3, Math.min(2.3, speed * 0.065)),
    safe: speed >= window.min && speed <= window.max,
    landingError: (speed - ideal) / (window.max - window.min),
  };
}
export function repairSeconds(reason) {
  return reason === "pit" ? 3 : reason === "corner" ? 2.5 : 3.5;
}
export function collisionAt(a, b) {
  return a.distanceToSquared(b) < 0.65 * 0.65;
}
export function advanceStunt(s, circuit, car, previous, dt) {
  const u = wrap(s.progress),
    f = featureAt(circuit.features, u);
  if (s.flight) {
    s.flight.elapsed += dt;
    if (s.progress >= s.flight.end) {
      const safe = s.flight.safe;
      s.flight = null;
      return safe ? "landed" : "jump";
    }
  }
  for (const jump of circuit.features.filter((x) => x.type === "jump")) {
    const takeoff = Math.floor(previous) + jump.takeoff;
    if (previous < takeoff && s.progress >= takeoff && !s.flight) {
      s.flight = {
        ...jumpFlight(
          s.speed,
          car,
          (jump.landing - jump.takeoff) * circuit.length,
        ),
        elapsed: 0,
        end: Math.floor(previous) + jump.landing,
      };
      return "takeoff";
    }
  }
  if (f?.type === "loop") {
    const frame = trackFrame(circuit.curve, u);
    if (
      frame.p.y > circuit.curve.getPointAt(f.start).y + 0.65 &&
      s.speed < loopMinimum(car) * (frame.up.y < 0.25 ? 1 : 0.6)
    )
      return "loop";
  }
  return null;
}
export function validFeatures(track) {
  if (track.features === undefined) return true;
  if (!Array.isArray(track.features) || track.features.length > 6) return false;
  const length = baseCurve(track).getLength();
  const list = track.features.map((f) => ({ type: f?.type, at: f?.at }));
  if (
    list.some(
      (f) => !Object.hasOwn(pieceNames, f.type) || !Number.isFinite(f.at),
    )
  )
    return false;
  const spans = list
    .map((f) => [
      f.at - pieceSpan[f.type] / length / 2,
      f.at + pieceSpan[f.type] / length / 2,
    ])
    .sort((a, b) => a[0] - b[0]);
  return spans.every(
    ([a, b], i) =>
      a >= 0.025 && b <= 0.975 && (!i || a - spans[i - 1][1] > 0.015),
  );
}
