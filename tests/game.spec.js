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
          settings: { quality: "low", sound: false },
        }),
      );
  });
});
test("collection and edited tracks persist across reload", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.locator('nav [data-page="shop"]').click();
  await page
    .getByRole("searchbox", { name: "Search cars" })
    .fill("Mini Cooper S");
  await page.locator('[data-car="mini"]').click();
  const purchased = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("slot-club:v1")),
  );
  expect(purchased.credits).toBe(100000000 - 8000);
  await page.reload();
  await page.locator('nav [data-page="garage"]').click();
  await expect(page.locator('[data-car="mini"]')).toContainText("Selected");
  await page.locator('nav [data-page="builder"]').click();
  await page.locator("#track-name").fill("Browser saved circuit");
  const before = await page.locator("[data-handle]").count();
  await page.locator('[data-piece="curve"]').click();
  await expect(page.locator("[data-handle]")).toHaveCount(before + 1);
  await page.locator('[data-action="undo"]').click();
  await expect(page.locator("[data-handle]")).toHaveCount(before);
  await page.locator('[data-action="save-track"]').click();
  await expect(page.locator("#toast")).toContainText("saved");
  await page.reload();
  await page.locator('nav [data-page="race"]').click();
  await expect(page.locator("#track-select")).toContainText(
    "Browser saved circuit",
  );
  expect(errors).toEqual([]);
});
test("race deslots, reset, cameras and pause work", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.locator('nav [data-page="race"]').click();
  await page.locator('[data-race-type="practice"]').click();
  await page.locator('[data-mode="driver"]').click();
  await page.locator('[data-action="start"]').click();
  await expect(page.locator("#race-stage")).toBeVisible({ timeout: 30000 });
  await expect(page.locator(".countdown")).toHaveCount(0, { timeout: 20000 });
  await page.keyboard.down("w");
  await expect(page.locator(".off-label")).toBeVisible({ timeout: 25000 });
  await page.keyboard.up("w");
  await page
    .locator('#race-message [data-action="reset"]')
    .click({ delay: 500 });
  await expect(page.locator(".off-label")).toHaveCount(0);
  await expect(page.locator("#speed")).toHaveText("0");
  await page.locator("#throttle").fill("40");
  await page.waitForTimeout(2200);
  await expect(page.locator(".off-label")).toHaveCount(0);
  await expect
    .poll(async () => Number(await page.locator("#speed").textContent()))
    .toBeGreaterThan(0);
  await page.locator("#throttle").fill("0");
  await page.keyboard.press("c");
  await expect(page.locator("#camera-label")).toHaveText("Cockpit");
  await page.keyboard.press("c");
  await expect(page.locator("#camera-label")).toHaveText("Bumper");
  await page.keyboard.press("c");
  await expect(page.locator("#camera-label")).toHaveText("Tabletop");
  await page.keyboard.press("p");
  await expect(page.locator(".modal h2")).toHaveText("Take a pit stop.");
  const time = await page.locator("#race-time").textContent();
  await page.waitForTimeout(250);
  await expect(page.locator("#race-time")).toHaveText(time);
  await page.locator('.modal [data-action="pause"]').click();
  await expect(page.locator(".modal")).toHaveCount(0);
  expect(errors).toEqual([]);
});
test("time trial finishes and saves a best lap", async ({ page }) => {
  await page.goto("/");
  await page.locator('nav [data-page="race"]').click();
  await page.locator("#track-select").selectOption("1");
  await page.locator('[data-race-type="time"]').click();
  await page.locator('[data-action="start"]').click();
  await expect(page.locator("#race-stage")).toBeVisible({ timeout: 30000 });
  await expect(page.locator(".countdown")).toHaveCount(0, { timeout: 20000 });
  await page.locator("#throttle").fill("30");
  await expect(page.locator(".modal h2")).toHaveText("That’s a wrap.", {
    timeout: 100000,
  });
  const data = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("slot-club:v1")),
  );
  expect(data.races).toBe(1);
  expect(data.stats.laps).toBe(3);
  expect(data.stats.completed).toBe(1);
  expect(data.stats.cars.porsche.laps).toBe(3);
  expect(Object.values(data.stats.tracks)[0].laps).toBe(3);
  expect(Object.values(data.records)[0]).toBeGreaterThan(0);
});
test("phone layouts fit and touch trigger drives", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  for (const target of ["home", "shop", "garage", "builder", "race"]) {
    await page.locator(`nav [data-page="${target}"]`).tap();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.locator('[data-race-type="practice"]').tap();
  await page.locator('[data-action="start"]').tap();
  await expect(page.locator("#race-stage")).toBeVisible({ timeout: 30000 });
  await expect(page.locator(".countdown")).toHaveCount(0, { timeout: 25000 });
  const client = await context.newCDPSession(page);
  const bounds = await page.locator("#trigger").boundingBox();
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
    ],
  });
  await expect
    .poll(async () => Number(await page.locator("#speed").textContent()))
    .toBeGreaterThan(0);
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.locator('[data-action="pause"]').tap();
  await expect(page.locator(".modal")).toBeVisible();
  expect(errors).toEqual([]);
  await context.close();
});

test("AI completes a Grand Prix and records the result", async ({ page }) => {
  await page.goto("/");
  await page.locator('nav [data-page="race"]').click();
  await page.locator("#track-select").selectOption("1");
  await page.locator('[data-action="start"]').click();
  await expect(page.locator(".modal h2")).toHaveText("A race worth chasing.", {
    timeout: 60000,
  });
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("slot-club:v1")).races,
    ),
  ).toBe(1);
});

test("dark theme, catalogue filters, quick race and stats persist", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Toggle dark theme" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.locator('nav [data-page="shop"]').click();
  await expect(page.locator(".car-card")).toHaveCount(24);
  await expect(page.locator("#car-count")).toHaveText("133 cars");
  await page.getByRole("searchbox", { name: "Search cars" }).fill("Countach");
  await expect(page.locator(".car-card:visible")).toHaveCount(1);
  await page.locator('nav [data-page="home"]').click();
  await page.locator('[data-action="quick-start"]').click();
  await expect(page.locator("#race-stage")).toBeVisible({ timeout: 30000 });
  await expect(page.locator(".countdown")).toHaveCount(0, { timeout: 20000 });
  await page.locator("#throttle").fill("30");
  await expect
    .poll(async () => Number(await page.locator("#speed").textContent()))
    .toBeGreaterThan(0);
  await page.locator('[data-action="pause"]').click();
  await page.locator('.modal [data-page="race"]').click();
  await page.locator('nav [data-page="stats"]').click();
  await expect(page.locator("h1")).toContainText("Every lap.");
  const s = await page.evaluate(
    () => JSON.parse(localStorage.getItem("slot-club:v1")).stats,
  );
  expect(s.starts).toBe(1);
  expect(s.seconds).toBeGreaterThan(0);
  expect(s.history[0].result).toBe("Exited");
  await page.reload();
  await page.locator('nav [data-page="stats"]').click();
  await expect(page.getByText("Exited", { exact: false })).not.toHaveCount(0);
});

test("priced catalogue pages and a newly sourced car reach the grid", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.locator('nav [data-page="shop"]').click();
  await expect(
    page.locator(".car-card").first().getByRole("meter"),
  ).toHaveCount(5);
  await page.locator('[data-garage-step="1"]').click();
  await expect(page.locator(".garage-pagination")).toContainText("PAGE 2 / 6");
  await page
    .getByRole("searchbox", { name: "Search cars" })
    .fill("Lancia Stratos");
  await expect(page.locator(".car-card")).toHaveCount(1);
  await page.locator('[data-car="lancia-stratos"]').click();
  await expect(page.locator("#credit-balance")).toContainText("99,975,000");
  await page.locator('[data-car="lancia-stratos"]').click();
  await expect(page.locator("#credit-balance")).toContainText("99,975,000");
  await page.locator('nav [data-page="race"]').click();
  await expect(page.locator("#car-select")).toHaveValue("lancia-stratos");
  await page.locator('[data-race-type="practice"]').click();
  await page.locator('[data-action="start"]').click();
  await expect(page.locator("#race-stage")).toBeVisible({ timeout: 45000 });
  await expect(page.locator(".countdown")).toHaveCount(0, { timeout: 25000 });
  await page.locator("#throttle").fill("30");
  await expect
    .poll(async () => Number(await page.locator("#speed").textContent()))
    .toBeGreaterThan(0);
  await page.locator('[data-action="pause"]').click();
  expect(errors).toEqual([]);
});
