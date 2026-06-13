const { chromium } = require("C:/Users/maoso/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright");

(async () => {
  const url = `file:///C:/Users/maoso/OneDrive/%E6%96%87%E6%A1%A3/New%20project%208/index.html?verify=${Date.now()}`;
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  const results = [];
  const longName = "Clean the extremely messy closet and organize every single shelf";

  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport, isMobile: viewport.width < 500 });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(url);
    await page.waitForTimeout(300);

    await page.fill("#choreNameInput", longName);
    await page.fill("#choreXpInput", "9999");
    await page.locator("#choreForm").evaluate((form) => form.requestSubmit());
    await page.waitForTimeout(300);

    const afterAdd = await page.evaluate((name) => ({
      capsules: document.querySelectorAll(".capsule").length,
      tickets: document.querySelectorAll(".ticket").length,
      exactTicket: [...document.querySelectorAll(".ticket strong")].some((item) => item.textContent === name),
      exactCapsule: [...document.querySelectorAll(".capsule")].some((item) => item.textContent === name),
      xpText: [...document.querySelectorAll(".ticket")].find((item) => item.textContent.includes(name))?.textContent.includes("9999 XP reward") ?? false,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
    }), longName);

    await page.locator(".ticket .remove-ticket").last().click();
    await page.waitForTimeout(300);
    const afterRemove = await page.evaluate((name) => ({
      capsules: document.querySelectorAll(".capsule").length,
      tickets: document.querySelectorAll(".ticket").length,
      removedTicket: ![...document.querySelectorAll(".ticket strong")].some((item) => item.textContent === name),
      removedCapsule: ![...document.querySelectorAll(".capsule")].some((item) => item.textContent === name),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
    }), longName);

    results.push({ viewport, afterAdd, afterRemove, errors });
    await page.close();
  }

  await browser.close();
  console.log(JSON.stringify(results, null, 2));
})();
