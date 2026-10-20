// Headless smoke check for the built front end.
// Loads ui/index.html + ui/dist/bundle.js in jsdom, then drives the app
// the way a user would: load the Category 5 fixture, check the urgent
// banner, switch lenses. Exits nonzero on any failure.
// Run `npm run build:ui` first, then `npm run smoke:ui`.
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

async function main() {
  const uiDir = path.join(__dirname, "..", "ui");
  const html = fs.readFileSync(path.join(uiDir, "index.html"), "utf8");
  const dom = new JSDOM(html, {
    url: "file://" + uiDir + "/",
    resources: "usable",
    runScripts: "dangerously",
    pretendToBeVisual: true,
  });
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("page load timeout")), 15000);
    dom.window.addEventListener("load", () => {
      clearTimeout(t);
      resolve();
    });
  });
  // bundle executes synchronously on load; give handlers a tick
  await new Promise((r) => setTimeout(r, 300));
  const doc = dom.window.document;
  const fail = (msg) => {
    console.error("SMOKE FAIL:", msg);
    process.exit(1);
  };

  if (!doc.querySelector(".lens-switcher")) fail("lens switcher did not render — bundle did not boot");
  const lensButtons = [...doc.querySelectorAll(".lens-switcher button")].map((b) => b.textContent);
  for (const q of ["You, now", "Where am I?", "How did I get here?", "What is interacting with what?", "Where am I going?", "What can I do about it?"]) {
    if (!lensButtons.some((t) => t.includes(q))) fail(`lens switcher missing "${q}"`);
  }

  const fixtureBtn = doc.querySelector('[data-action="fixture"][data-case-id="5.1"]');
  if (!fixtureBtn) fail("fixture button 5.1 missing");
  fixtureBtn.click();
  await new Promise((r) => setTimeout(r, 100));
  const banner = doc.querySelector("[data-urgent-action]");
  if (!banner) fail("no urgent banner after loading 5.1");
  if (!/hold|comfort|child/i.test(banner.textContent)) fail("urgent banner text wrong: " + banner.textContent);

  const relBtn = doc.querySelector('[data-action="view"][data-view="relationships"]');
  relBtn.click();
  await new Promise((r) => setTimeout(r, 100));
  if (!doc.querySelector('[data-lens-view="relationships"]')) fail("relationships lens did not render");
  if (!doc.querySelector('[data-layers-for="relationships"]')) fail("layers missing in relationships lens");
  if (!doc.querySelector("[data-uncertainty-panel]")) fail("uncertainty panel missing in lens view");

  console.log("SMOKE OK: bundle boots, five lenses + home present, 5.1 urgent action renders first, lens switch re-renders with layers and uncertainty panel.");
  dom.window.close();
}

main().catch((e) => {
  console.error("SMOKE FAIL:", e.message);
  process.exit(1);
});
