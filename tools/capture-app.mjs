import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 1030 },
  deviceScaleFactor: 1,
});
let errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await page.goto("http://localhost:5173");
await page.waitForTimeout(2500);
await page.screenshot({ path: "docs/screenshots/paddock.png" });
await page.locator('nav [data-page="shop"]').click();
await page.waitForTimeout(600);
await page.screenshot({ path: "docs/screenshots/garage.png", fullPage: true });
await page.locator('nav [data-page="builder"]').click();
await page.screenshot({ path: "docs/screenshots/studio.png" });
await page.locator('nav [data-page="race"]').click();
await page.locator('[data-mode="driver"]').click();
await page.locator('[data-race-type="practice"]').click();
await page.locator('[data-action="start"]').click();
await page.waitForSelector("#race-stage");
await page.waitForFunction(() => !document.querySelector(".countdown"), null, {
  timeout: 25000,
});
await page.locator("#throttle").fill("35");
await page.waitForTimeout(1500);
await page.screenshot({ path: "docs/screenshots/racing.png" });
await page.keyboard.press("c");
await page.waitForTimeout(700);
await page.screenshot({ path: "docs/screenshots/cockpit.png" });
await page.keyboard.press("c");
await page.keyboard.press("c");
await page.keyboard.press("c");
await page.keyboard.press("p");
await page.locator('.modal [data-page="race"]').click();
await page.locator("#track-select").selectOption("7");
await page.locator('[data-action="start"]').click();
await page.waitForSelector("#race-stage");
await page.waitForFunction(() => !document.querySelector(".countdown"), null, {
  timeout: 25000,
});
await page.locator("#throttle").fill("35");
await page.waitForTimeout(1500);
await page.screenshot({ path: "docs/screenshots/night.png" });
await page.keyboard.press("p");
await page.locator('.modal [data-page="race"]').click();
await page.locator('nav [data-page="home"]').click();
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: "docs/screenshots/mobile.png", fullPage: true });
console.log("Browser errors", errors);
await browser.close();
