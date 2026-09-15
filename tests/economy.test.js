import { test } from "node:test";
import assert from "node:assert/strict";
import { cars, stepSpeed } from "../src/data.js";
import { STARTING_CREDITS, purchaseCar, ratingLabels } from "../src/economy.js";
import { normalize } from "../src/storage.js";
test("every higher-priced car improves all ratings and handling parameters", () => {
  for (const a of cars)
    for (const b of cars)
      if (a.price > b.price) {
        for (const k of Object.keys(ratingLabels)) {
          assert.ok(a.ratings[k] > b.ratings[k], `${a.id} ${b.id} ${k}`);
        }
        for (const k of ["speed", "grip", "accel", "braking", "stability"])
          assert.ok(a[k] > b[k]);
      }
  assert.ok(new Set(cars.map((c) => JSON.stringify(c.ratings))).size > 20);
});
test("local credit purchases debit once and existing collections migrate intact", () => {
  const p = normalize({
    version: 1,
    owned: ["porsche", "mini"],
    selected: "mini",
  });
  assert.equal(p.credits, STARTING_CREDITS);
  const c = cars.find((c) => c.id === "lancia-stratos");
  assert.ok(purchaseCar(p, c).purchased);
  assert.equal(p.credits, STARTING_CREDITS - c.price);
  assert.equal(p.creditsSpent, c.price);
  assert.equal(purchaseCar(p, c).purchased, false);
  assert.equal(p.credits, STARTING_CREDITS - c.price);
  assert.equal(p.owned.filter((id) => id === c.id).length, 1);
  p.credits = 0;
  const before = p.selected;
  assert.equal(
    purchaseCar(
      p,
      cars.find((c) => c.id === "ferrari-f40"),
    ).ok,
    false,
  );
  assert.equal(p.selected, before);
});
test("starter credits cover the entire catalogue and braking ratings affect stopping", () => {
  assert.ok(cars.reduce((sum, c) => sum + c.price, 0) < STARTING_CREDITS);
  const fast = cars.find((c) => c.tier === 4),
    slow = cars.find((c) => c.tier === 0);
  assert.ok(
    stepSpeed(15, 0, true, 0.2, fast) < stepSpeed(15, 0, true, 0.2, slow),
  );
});
