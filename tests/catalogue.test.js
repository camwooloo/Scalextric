import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { cars } from "../src/data.js";
test("every listed model has an asset, image and matching creator licence metadata", () => {
  const credits = JSON.parse(
    fs.readFileSync("public/models/credits.json", "utf8"),
  );
  assert.equal(cars.length, 133);
  assert.equal(new Set(cars.map((c) => c.id)).size, cars.length);
  for (const car of cars) {
    const c = credits.find((x) => x.id === car.id);
    assert.ok(c, car.id);
    assert.match(
      c.license,
      /creativecommons\.org\/licenses\/(by|by-sa|by-nc|by-nc-sa)\/4.0/,
    );
    assert.ok(
      fs.statSync(`public/images/cars/${car.id}.webp`).size > 1000,
      car.id,
    );
    for (const suffix of car.sharedModel ? [""] : ["", "-low"]) {
      const b = fs.readFileSync(`public/models/${car.id}${suffix}.glb`);
      assert.equal(b.readUInt32LE(0), 0x46546c67);
      const json = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)));
      assert.equal(json.asset.extras.source, c.source, car.id);
      assert.equal(json.asset.extras.license, c.license, car.id);
    }
  }
});
test("every source catalogue entry is represented or explicitly recorded as an exact-source duplicate", () => {
  const manifest = JSON.parse(fs.readFileSync("tools/catalogue-sources.json"));
  const sources = new Set(
    JSON.parse(fs.readFileSync("public/models/credits.json")).map(
      (c) => c.source,
    ),
  );
  for (const entry of manifest) {
    assert.ok(!entry.issue);
    assert.ok(sources.has(entry.source), entry.id || entry.duplicate);
  }
});
