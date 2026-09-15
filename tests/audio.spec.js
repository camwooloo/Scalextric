import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("slot-club:v1"))
      localStorage.setItem(
        "slot-club:v1",
        JSON.stringify({
          version: 1,
          owned: ["porsche"],
          selected: "porsche",
          tracks: [],
          settings: { quality: "low", sound: true, music: false },
        }),
      );
    const Native = window.AudioContext;
    window.AudioContext = class extends Native {
      constructor(...args) {
        super(...args);
        window.__audio = this;
        window.__sources = [];
      }
      createOscillator() {
        return this.track(super.createOscillator());
      }
      createBufferSource() {
        return this.track(super.createBufferSource());
      }
      track(node) {
        const entry = { start: null, stop: null };
        window.__sources.push(entry);
        const start = node.start.bind(node),
          stop = node.stop.bind(node);
        node.start = (when = 0, ...args) => {
          entry.start = when;
          return start(when, ...args);
        };
        node.stop = (when = 0) => {
          entry.stop = when;
          return stop(when);
        };
        return node;
      }
    };
  });
});
const liveSources = (page) =>
  page.evaluate(
    () =>
      window.__sources?.filter(
        (s) =>
          s.start !== null &&
          (s.stop === null || s.stop > window.__audio.currentTime),
      ).length || 0,
  );
test("engine sources stop at the results screen and stay stopped", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.locator('nav [data-page="race"]').click();
  await page.locator("#track-select").selectOption("1");
  await page.locator('[data-race-type="time"]').click();
  await page.locator('[data-action="start"]').click();
  await expect(page.locator("#race-stage")).toBeVisible({ timeout: 30000 });
  await expect(page.locator(".countdown")).toHaveCount(0, { timeout: 20000 });
  await page.locator("#throttle").fill("45");
  await expect.poll(() => liveSources(page)).toBe(2);
  await expect(page.locator(".modal h2")).toHaveText("That’s a wrap.", {
    timeout: 90000,
  });
  await expect.poll(() => liveSources(page)).toBe(0);
  await page.waitForTimeout(1000);
  expect(await liveSources(page)).toBe(0);
  await page.locator('.modal [data-page="home"]').click();
  expect(await liveSources(page)).toBe(0);
  expect(errors).toEqual([]);
});
test("music is visibly off by default, plays only when enabled and settings persist", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const toggle = page.locator('header [data-action="music"]');
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(toggle).toContainText("OFF");
  expect(await page.evaluate(() => !!window.__audio)).toBe(false);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(() => page.evaluate(() => window.__sources.length))
    .toBeGreaterThan(0);
  await page.locator('nav [data-page="home"]').click();
  await page.locator(".footer-settings").click();
  await page.locator("#music-volume").fill("18");
  await page.locator("#engine-volume").fill("30");
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem("slot-club:v1")).settings,
  );
  expect(saved).toMatchObject({
    music: true,
    musicVolume: 0.18,
    engineVolume: 0.3,
  });
  await page.reload();
  await expect(toggle).toContainText("ON");
  await page.locator(".footer-settings").click();
  await expect(page.locator("#music-volume")).toHaveValue("18");
  await expect(page.locator("#engine-volume")).toHaveValue("30");
  await page.locator("#music-toggle").uncheck();
  await expect(toggle).toContainText("OFF");
  await expect.poll(() => liveSources(page)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  expect(errors).toEqual([]);
});
test("pausing, pit recovery and exiting mute the engine", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.locator('nav [data-page="race"]').click();
  await page.locator('[data-race-type="practice"]').click();
  await page.locator('[data-action="start"]').click();
  await expect(page.locator("#race-stage")).toBeVisible({ timeout: 30000 });
  await expect(page.locator(".countdown")).toHaveCount(0, { timeout: 20000 });
  await expect.poll(() => liveSources(page)).toBe(2);
  await page.screenshot({ path: "/tmp/slot-audio-mobile.png" });
  await page.locator('[data-action="pit"]').click();
  await expect.poll(() => liveSources(page)).toBe(0);
  await expect(page.locator(".off-label")).toHaveCount(0, { timeout: 8000 });
  await expect.poll(() => liveSources(page)).toBe(2);
  await page.locator('[data-action="pause"]').click();
  await expect.poll(() => liveSources(page)).toBe(0);
  await page.locator('.modal [data-page="race"]').click();
  await page.waitForTimeout(300);
  expect(await liveSources(page)).toBe(0);
});
