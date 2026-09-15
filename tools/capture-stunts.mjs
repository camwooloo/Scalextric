import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(
  `${process.env.BASE_URL || "http://127.0.0.1:5173"}/tools/brand.html`,
);
await page.evaluate(async () => {
  const [{ World }, { presets, cars }] = await Promise.all([
    import("/src/scene.js"),
    import("/src/data.js"),
  ]);
  document.body.innerHTML =
    '<div id="gallery" style="width:100vw;height:100vh"></div>';
  document.body.style.margin = "0";
  const w = new World(document.getElementById("gallery"));
  w.lowDetail = true;
  w.build(presets.find((t) => t.name === "Loop Laboratory"));
  await w.setCars(cars[0], cars[4]);
  await w.prepare();
  const f = w.features[0];
  w.draw(
    {
      racing: true,
      progress: f.at,
      ai: 0,
      opponent: false,
      cam: "Tabletop",
      off: 0,
    },
    0,
    0,
  );
  w.camera.position.set(-6, 10, 11);
  w.camera.lookAt(1, 3, -6);
  w.camera.fov = 48;
  w.camera.updateProjectionMatrix();
  w.renderer.render(w.scene, w.camera);
});
await page
  .locator("canvas")
  .screenshot({ path: "docs/screenshots/stunt-loop.png" });
await browser.close();
