import fs from "node:fs";
const credits = JSON.parse(
  fs.readFileSync("public/models/credits.json", "utf8"),
);
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const items = credits
  .map((c) => {
    const licenceUrl = c.license.match(/https?:[^)]+/)[0];
    return `<article><img src="/images/cars/${c.id}.webp" alt="${escape(c.title)}"><div><h2>${escape(c.title)}</h2><p>Created by ${escape(c.author)}</p><p><a href="${c.source}">Original model ↗</a> · <a href="${licenceUrl}">${escape(c.license.split(" (")[0])}</a> · <a href="/models/${c.id}.glb">Optimised model file</a></p><small>${escape(c.modifications)}</small></div></article>`;
  })
  .join("");
fs.writeFileSync(
  "public/credits.html",
  `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Model artists & licences · Slot Club</title><style>*{box-sizing:border-box}body{margin:0;background:#f1f1e8;color:#29392f;font:15px/1.7 system-ui,sans-serif}main{max-width:1000px;margin:auto;padding:50px 25px}a{color:#c95630;text-underline-offset:4px}h1{font-size:45px;line-height:1.1;letter-spacing:-2px}h2{font-size:18px;margin:0}p{color:#748268}article{display:flex;align-items:center;gap:25px;border-top:1px solid #dce1d3;padding:28px 0}img{width:230px;mix-blend-mode:multiply}small{color:#87927b}footer{padding-top:35px;border-top:1px solid #dce1d3}@media(max-width:600px){article{display:block}img{width:100%;max-width:300px}h1{font-size:35px}}</style><main><a href="/">← Back to the club</a><h1>Made by talented people.</h1><p>These detailed car models are shared by their creators under the licences below. Cars are collected with local sandbox credits in Slot Club; no real money is involved. Model names reflect the actual assets used; these are community-made representations, not manufacturer CAD models.</p>${items}<footer><p>Each model, its optimised files and derived renders retain the licence shown above. Some require non-commercial use; some additionally require share-alike. Attribution applies throughout. The social preview uses James Slater’s CC BY 4.0 Lancia Stratos render. Code and other site content are not relicensed by those asset licences.</p><p>Independent fan project. Not affiliated with Scalextric, Hornby, or the vehicle manufacturers. All marques and vehicle names belong to their respective owners.</p></footer></main></html>`,
);
