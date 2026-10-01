import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { PLAYER_SESSION_STORAGE_KEY } from "../../apps/web/src/lib/player-session";

async function expectNoAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  expect(results.violations).toEqual([]);
}

test("la entrada es accesible y conecta con el servidor", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Servidor conectado")).toBeVisible();
  await expect(page.getByRole("button", { name: /Crear/ })).toBeEnabled();
  await expectNoAccessibilityViolations(page);
});

test("dos jugadores entran, comienzan y recuperan la partida", async ({
  browser,
}) => {
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
    await expect(host.getByText("Servidor conectado")).toBeVisible();
    await host.getByLabel("Tu nombre").fill("Ada");
    await host.getByRole("button", { name: /Crear/ }).click();

    const roomTitle = host.getByRole("heading", { name: /^Sala / });
    await expect(roomTitle).toBeVisible();
    const roomCode = (await roomTitle.textContent())?.replace("Sala ", "");
    expect(roomCode).toMatch(/^[A-Z2-9]{5}$/);

    await guest.goto("/");
    await expect(guest.getByText("Servidor conectado")).toBeVisible();
    await guest.getByLabel("Tu nombre").fill("Linus");
    await guest.getByLabel("Código de sala").fill(roomCode!);
    await guest.getByRole("button", { name: /Entrar/ }).click();

    await expect(host.getByRole("heading", { name: /Linus/ })).toBeVisible();
    await expect(guest.getByRole("heading", { name: /Ada/ })).toBeVisible();
    await expectNoAccessibilityViolations(host);

    await host.getByRole("button", { name: "Estoy listo" }).click();
    await guest.getByRole("button", { name: "Estoy listo" }).click();

    await expect(
      host.getByRole("heading", { name: "Duelo de memoria" }),
    ).toBeVisible();
    await expect(
      guest.getByRole("heading", { name: "Duelo de memoria" }),
    ).toBeVisible();

    const sessionBeforeReload = await host.evaluate(
      (key) => sessionStorage.getItem(key),
      PLAYER_SESSION_STORAGE_KEY,
    );
    expect(sessionBeforeReload).toBeTruthy();

    await host.reload();
    await expect(
      host.getByRole("heading", { name: "Duelo de memoria" }),
    ).toBeVisible();
    await expect(host.getByText("Ada", { exact: true })).toBeVisible();
    await expect(host.getByText("Linus", { exact: true })).toBeVisible();
    expect(
      await host.evaluate(
        (key) => sessionStorage.getItem(key),
        PLAYER_SESSION_STORAGE_KEY,
      ),
    ).toBe(sessionBeforeReload);

    await expect(host.getByRole("button", { name: /^Verde/ })).toBeEnabled({
      timeout: 15_000,
    });
    expect(consoleErrors).toEqual([]);
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});
