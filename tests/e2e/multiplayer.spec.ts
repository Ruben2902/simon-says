import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { PLAYER_SESSION_STORAGE_KEY } from "../../apps/web/src/lib/player-session";

async function expectNoAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  expect(results.violations).toEqual([]);
}

test("English is the default language and the entry is accessible", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByText("Server connected")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create" })).toBeEnabled();
  await expectNoAccessibilityViolations(page);
});

test("the selected language persists after reload", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Server connected")).toBeVisible();
  await page.getByRole("button", { name: "Spanish" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(
    page.getByRole("heading", { name: "Entra al duelo" }),
  ).toBeVisible();

  await page.reload();
  await expect(page.getByText("Servidor conectado")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
});

test("two players join, start and recover the match", async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  const consoleErrors: string[] = [];

  for (const page of [host, guest]) {
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
  }

  try {
    await host.goto("/");
    await expect(host.getByText("Server connected")).toBeVisible();
    await host.getByLabel("Your name").fill("Ada");
    await host.getByRole("button", { name: "Create" }).click();

    const roomTitle = host.getByRole("heading", { name: /^Room / });
    await expect(roomTitle).toBeVisible();
    const roomCode = (await roomTitle.textContent())?.replace("Room ", "");
    expect(roomCode).toMatch(/^[A-Z2-9]{5}$/);

    await guest.goto("/");
    await expect(guest.getByText("Server connected")).toBeVisible();
    await guest.getByLabel("Your name").fill("Linus");
    await guest.getByLabel("Room code").fill(roomCode!);
    await guest.getByRole("button", { name: "Enter" }).click();

    await expect(host.getByRole("heading", { name: /Linus/ })).toBeVisible();
    await expect(guest.getByRole("heading", { name: /Ada/ })).toBeVisible();
    await expectNoAccessibilityViolations(host);

    await host.getByRole("button", { name: "I'm ready" }).click();
    await guest.getByRole("button", { name: "I'm ready" }).click();

    await expect(
      host.getByRole("heading", { name: "Memory duel" }),
    ).toBeVisible();
    await expect(
      guest.getByRole("heading", { name: "Memory duel" }),
    ).toBeVisible();

    const sessionBeforeReload = await host.evaluate(
      (key) => sessionStorage.getItem(key),
      PLAYER_SESSION_STORAGE_KEY,
    );
    expect(sessionBeforeReload).toBeTruthy();

    await host.reload();
    await expect(
      host.getByRole("heading", { name: "Memory duel" }),
    ).toBeVisible();
    await expect(host.getByText("Ada", { exact: true })).toBeVisible();
    await expect(host.getByText("Linus", { exact: true })).toBeVisible();
    expect(
      await host.evaluate(
        (key) => sessionStorage.getItem(key),
        PLAYER_SESSION_STORAGE_KEY,
      ),
    ).toBe(sessionBeforeReload);

    await expect(host.getByRole("button", { name: /^Green/ })).toBeEnabled({
      timeout: 15_000,
    });
    expect(consoleErrors).toEqual([]);
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});
