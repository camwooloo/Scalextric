import { chromium } from "@playwright/test";
import sharp from "sharp";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 550 } });
page.on("pageerror", (e) => console.log("ERROR", e.message));
await page.goto("http://localhost:5173/tools/showroom.html");
await page.waitForFunction(() => window.ready);
for (const id of ["porsche", "ford", "mclaren", "mini", "aston", "bmw"]) {
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
