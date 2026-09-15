import test from "node:test";
import assert from "node:assert/strict";
import { stepSpeed, cornerLoad, cars } from "../src/data.js";

test("throttle accelerates; release slows; brake stops without reversing", () => {
  let speed = 0;
  for (let i = 0; i < 120; i++)
    speed = stepSpeed(speed, 1, false, 1 / 60, cars[0]);
  assert.ok(speed > 10);
  const coasting = stepSpeed(speed, 0, false, 1, cars[0]);
  const braking = stepSpeed(speed, 0, true, 1, cars[0]);
  assert.ok(coasting < speed);
  assert.ok(braking < coasting);
  assert.equal(stepSpeed(1, 0, true, 1, cars[0]), 0);
});
test("car top speed is bounded and speed doubles quadruple lateral force", () => {
  assert.equal(stepSpeed(100, 1, false, 1, cars[0]), cars[0].speed);
  assert.equal(cornerLoad(20, 0.1, 24), cornerLoad(10, 0.1, 24) * 4);
  assert.ok(cornerLoad(5, 0.2, 24) < 1.2);
  assert.ok(cornerLoad(20, 0.2, 24) > 1.2);
  assert.ok(cornerLoad(15, 0.2, 29) < cornerLoad(15, 0.2, 20));
});
