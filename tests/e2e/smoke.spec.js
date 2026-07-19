// @ts-check
import { test, expect } from "@playwright/test";

test("R1-12: full flow completes headlessly and verdict renders judge scores", async ({ page }) => {
  const consoleErrors = [];
  page.on("pageerror", (err) => consoleErrors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });

  await page.goto("/");

  // Argument selection: pick a category, then a pre-written question.
  await expect(page.locator("text=Choose the argument")).toBeVisible();
  await page.locator("button.chip:has-text('Food')").click();
  await page.locator("button.question-button:has-text('pineapple')").click();

  // Fighter selection.
  await expect(page.locator("text=Choose your fighter")).toBeVisible();
  await page.locator("button.fighter-card:has-text('Logician')").click();
  await page.locator("button.primary-button:has-text('Fight as')").click();

  // Location selection.
  await expect(page.locator("text=Choose the arena")).toBeVisible();
  await page.locator("button.location-card:has-text('Forum')").click();

  // Fight screen: deterministic seeded match reaches KO.
  await expect(page.locator("canvas#stage")).toBeVisible();
  // The seeded starter match resolves on its own; wait for verdict.
  await expect(page.locator(".verdict-title")).toBeVisible();

  // Verdict screen renders per-judge scores.
  const scoreCells = page.locator(".judge-card");
  await expect(scoreCells).toHaveCount(3);
  for (const cell of await scoreCells.all()) {
    const text = await cell.textContent();
    expect(text).toMatch(/\/[0-9]+/);
  }

  expect(consoleErrors).toHaveLength(0);
});
