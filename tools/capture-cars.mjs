import { chromium } from "@playwright/test";
import sharp from "sharp";
import fs from "node:fs";
import {cars} from "../src/data.js";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 550 } });
page.on("pageerror", (e) => console.log("ERROR", e.message));
await page.route("**/@vite/client",route=>route.fulfill({contentType:"application/javascript",body:""}));
await page.goto("http://localhost:5173/tools/showroom.html");
await page.waitForFunction(() => window.ready);
for (const id of cars.filter(c=>(!fs.existsSync(`public/images/cars/${c.id}.webp`) || process.argv.includes("--all") || process.argv.includes(c.id))).map(c=>c.id)) {
  console.log(id, await page.evaluate((id) => window.showCar(id), id));
  const data = await page.evaluate(() =>
    document.querySelector("canvas").toDataURL("image/png"),
  );
  const buffer = Buffer.from(data.split(",")[1], "base64");
  await sharp(buffer)
    .trim({ threshold: 5 })
    .extend({
      top: 20,
      bottom: 20,
      left: 20,
      right: 20,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality: 90 })
    .toFile(`public/images/cars/${id}.webp`);
}
await browser.close();
