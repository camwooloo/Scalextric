// Guide pin + magnetic downforce. Only horizontal curvature can throw a car out.
export function sampleCurvature(curve, length, u) {
  const gap = 0.55 / length;
  const before = curve
    .getTangentAt((((u - gap) % 1) + 1) % 1)
    .setY(0)
    .normalize();
  const after = curve
    .getTangentAt((u + gap) % 1)
    .setY(0)
    .normalize();
  return before.angleTo(after) / 1.1;
}
export function stepGrip(load, slip, dt) {
  // Transient force spikes produce a warning, not an instant deslot.
  return Math.max(0, slip + (load > 1 ? (load - 1) * dt : -dt * 1.8));
}
export function resetHandling(state) {
  state.off = 0;
  state.speed = 0;
  state.load = 0;
  state.slip = 0;
  state.recovery = 1.2;
  state.fly.set(0, 0, 0);
}
