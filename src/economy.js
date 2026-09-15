// Local sandbox currency. No payments or external balances are involved.
export const STARTING_CREDITS = 100_000_000;
export const tiers = [
  { name: "Club", letter: "D", price: 8000, min: 30, max: 42 },
  { name: "Sport", letter: "C", price: 25000, min: 45, max: 57 },
  { name: "Performance", letter: "B", price: 75000, min: 60, max: 72 },
  { name: "Elite", letter: "A", price: 200000, min: 75, max: 87 },
  { name: "Legends", letter: "S", price: 600000, min: 90, max: 100 },
];
export const ratingLabels = {
  speed: "Top speed",
  accel: "Acceleration",
  grip: "Cornering",
  braking: "Braking",
  stability: "Stability",
  jump: "Jump control",
  downforce: "Downforce",
};
export function rateCar(car) {
  const name = (car.name + " " + car.id).toLowerCase();
  let tier = 2;
  if (/golf|beetle|mini|civic|crx|s800|300sl|300 sl|ae86/.test(name)) tier = 0;
  else if (
    /m3-e30|m3-e36|m3-e46|m3 csl|m1\b|quattro|stratos|delta|lancia|930|mustang|250.gto|integra|elise|exige-s|evora-s/.test(
      name,
    )
  )
    tier = 1;
  else if (
    /bolide|tourbillon|divo|nevera|jesko|one1|koenigsegg-one|senna|solus|speedtail|mclaren-w1|amg-one|peugeot-9x8|porsche-963|787b|audi-r1[58]|ts030|vw-idr/.test(
      name,
    )
  )
    tier = 4;
  else if (
    /gt3|gt3-rs|gt3 rs|p1|ferrari-(?:enzo|laferrari|sf90|849|f40|f50)|ferrari f40|f50|mclaren-f1|mclaren-765|chiron|veyron|aventador|centenario|reventon|revuelto|sian|temerario|veneno|pagani|imola|ccx|agera|carrera-gt|maserati-mc12|xj220|amggt3/.test(
      name,
    )
  )
    tier = 3;
  const kind =
    /rally|quattro|stratos|delta|mini|golf|civic|elise|exige|yaris/.test(name)
      ? "Corner specialist"
      : /mustang|supra|countach|xj220|bugatti|koenigsegg|turbo|f50/.test(name)
        ? "Straight-line pace"
        : "All-rounder";
  const t = tiers[tier],
    offsets =
      kind === "Corner specialist"
        ? [0.28, 0.58, 1, 0.82, 1, 1, 0.5]
        : kind === "Straight-line pace"
          ? [1, 0.87, 0.3, 0.46, 0.36, 0.35, 0.7]
          : [0.7, 0.66, 0.8, 0.75, 0.82, 0.7, 0.9];
  let hash = 0;
  for (const ch of car.id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const ratings = Object.fromEntries(
    Object.keys(ratingLabels).map((key, j) => [
      key,
      Math.round(
        t.min +
          (t.max - t.min) *
            Math.max(
              0,
              Math.min(1, offsets[j] + (((hash >>> (j * 4)) % 7) - 3) * 0.018),
            ),
      ),
    ]),
  );
  return {
    ...car,
    tier,
    price: t.price,
    archetype: kind,
    ratings,
    speed: 17 + ratings.speed * 0.12,
    accel: 6 + ratings.accel * 0.075,
    grip: 18 + ratings.grip * 0.22,
    braking: 16 + ratings.braking * 0.2,
    stability: 0.17 + ratings.stability * 0.001,
    jump: ratings.jump,
    downforce: ratings.downforce,
  };
}
export function purchaseCar(profile, car) {
  if (profile.owned.includes(car.id)) {
    profile.selected = car.id;
    return { ok: true, purchased: false };
  }
  if (!Number.isFinite(profile.credits) || profile.credits < car.price)
    return { ok: false, purchased: false };
  profile.credits -= car.price;
  profile.creditsSpent = (profile.creditsSpent || 0) + car.price;
  profile.owned.push(car.id);
  profile.selected = car.id;
  return { ok: true, purchased: true };
}
