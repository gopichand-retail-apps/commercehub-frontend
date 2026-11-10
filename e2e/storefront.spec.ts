import { expect, test } from "@playwright/test";
import commercehubModel from "../public/commercehub-model.json";

const expectedDataMode = process.env.NEXT_PUBLIC_IS_MOCK === "false" ? "live" : "mock";

async function expectSelectedDataMode(page: import("@playwright/test").Page) {
  await expect(page.locator(".store-page")).toHaveAttribute("data-mode", expectedDataMode);
}

test("the public model controls rendered copy and document locale", async ({ page }) => {
  const localizedModel = {
    ...commercehubModel,
    locale: "es-ES",
    messages: {
      ...commercehubModel.messages,
      "meta.title": "Comercio de prueba | Common Ground",
      "hero.titleLead": "Objetos para",
      "hero.titleEmphasis": "vivir mejor.",
    },
  };

  await page.route("**/commercehub-model.json", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(localizedModel),
    }),
  );
  await page.goto("/");
  await expectSelectedDataMode(page);

  await expect(page.locator("#hero-title")).toContainText("Objetos para");
  await expect(page.locator("#hero-title")).toContainText("vivir mejor.");
  await expect(page.locator("html")).toHaveAttribute("lang", "es-ES");
  await expect(page).toHaveTitle("Comercio de prueba | Common Ground");
});

test("localhost storefront loads the API catalog and displays its server quote", async ({ page }) => {
  const apiResponses: Array<{ path: string; status: number }> = [];
  page.on("response", (response) => {
    const path = new URL(response.url()).pathname;
    if (path.startsWith("/api/v1/")) apiResponses.push({ path, status: response.status() });
  });

  await page.goto("/");
  await expectSelectedDataMode(page);
  await expect(page.locator(".product-card")).toHaveCount(8);
  const productImages = page.locator(".product-card .product-image");
  await expect(page.locator(".hero-image")).toHaveAttribute("loading", "eager");
  await expect(productImages.nth(0)).toHaveAttribute("loading", "eager");
  await expect(productImages.nth(1)).toHaveAttribute("loading", "eager");
  await expect(productImages.nth(2)).toHaveAttribute("loading", "eager");
  await expect(productImages.nth(3)).toHaveAttribute("loading", "lazy");
  const productNames = await page.locator(".product-card h3").allTextContents();
  const daypackIndex = productNames.indexOf(commercehubModel.data.products["everyday-daypack"].name);
  expect(daypackIndex).toBeGreaterThan(0);
  expect(daypackIndex).toBeLessThan(3);
  await expect(productImages.nth(daypackIndex)).toHaveAttribute("loading", "eager");
  const daypackImages = page.getByRole("img", {
    name: commercehubModel.data.products["everyday-daypack"].imageAlt,
  });
  await expect(daypackImages).toHaveCount(2);
  await expect(daypackImages.nth(0)).toHaveAttribute("loading", "eager");
  await expect(daypackImages.nth(1)).toHaveAttribute("loading", "eager");
  await page.getByRole("button", { name: "Add Daybreak Coffee to bag" }).click();
  await page.getByRole("button", { name: /Bag 1/ }).click();
  await expect(page.locator(".quote-total strong")).toHaveText("$22.95");
  await expect(page.getByRole("button", { name: /Continue to checkout/ })).toBeEnabled();

  expect(apiResponses).toContainEqual({ path: "/api/v1/products", status: 200 });
  expect(apiResponses).toContainEqual({ path: "/api/v1/orders/quote", status: 200 });
});

test("invalid promo errors are readable and removing the promo restores the quote", async ({ page }) => {
  await page.goto("/");
  await expectSelectedDataMode(page);
  await expect(page.locator(".product-card")).toHaveCount(8);
  await page.getByRole("button", { name: "Add Daybreak Coffee to bag" }).click();
  await page.getByRole("button", { name: /Bag 1/ }).click();
  await expect(page.locator(".quote-total strong")).toHaveText("$22.95");

  await page.getByPlaceholder("Try HELLO10").fill("NOTREAL");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.locator(".quote-error")).toHaveText("That promotion code is not available.");

  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(page.locator(".quote-total strong")).toHaveText("$22.95");
});

test("mobile layout has no horizontal overflow and Escape closes the bag", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expectSelectedDataMode(page);
  await expect(page.locator(".product-card")).toHaveCount(8);

  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(horizontalOverflow).toBe(false);

  await page.getByRole("button", { name: /Bag 0/ }).click();
  const bagDialog = page.locator("dialog.cart-dialog");
  await expect(bagDialog).toBeVisible();
  const drawer = await bagDialog.boundingBox();
  expect(drawer?.width).toBeLessThanOrEqual(390);

  await page.keyboard.press("Escape");
  await expect(bagDialog).not.toBeVisible();
});

test("checkout uses an API-issued session and authenticated order request", async ({ page }) => {
  const sessionResponsePromise = page.waitForResponse((response) => {
    const request = response.request();
    return new URL(response.url()).pathname === "/api/v1/sessions" && request.method() === "POST";
  });

  await page.goto("/");
  await expectSelectedDataMode(page);
  const sessionResponse = await sessionResponsePromise;
  expect(sessionResponse.status()).toBe(201);
  expect((await sessionResponse.json()).session.role).toBe("CUSTOMER");
  await expect(page.locator("#synthetic-role")).toBeEnabled();

  await page.getByRole("button", { name: "Add Daybreak Coffee to bag" }).click();
  await page.getByRole("button", { name: /Bag 1/ }).click();
  await expect(page.locator(".quote-total strong")).toHaveText("$22.95");
  await page.getByRole("button", { name: /Continue to checkout/ }).click();
  await expect(page.locator("dialog.checkout-dialog")).toBeVisible();

  const orderResponsePromise = page.waitForResponse((response) => {
    const request = response.request();
    return new URL(response.url()).pathname === "/api/v1/orders" && request.method() === "POST";
  });
  await page.locator(".place-order-button").click();
  const orderResponse = await orderResponsePromise;
  expect(orderResponse.status()).toBe(201);
  expect(orderResponse.request().headers().authorization).toMatch(/^Bearer /);
  expect(orderResponse.request().headers()["x-order-access-key"]).toBeUndefined();
  await expect(page.locator("dialog.receipt-dialog")).toBeVisible();
});

test("expired checkout session clears credentials, preserves the cart, and waits for reauthentication", async ({
  page,
}) => {
  await page.goto("/");
  await expectSelectedDataMode(page);
  await expect(page.getByText(commercehubModel.messages["identity.sessionReady"])).toBeVisible();
  const expiredToken = await page.evaluate(() => sessionStorage.getItem("syntheticSessionToken"));
  expect(expiredToken).toBeTruthy();

  await page.getByRole("button", { name: "Add Daybreak Coffee to bag" }).click();
  await page.getByRole("button", { name: /Bag 1/ }).click();
  await page.getByRole("button", { name: /Continue to checkout/ }).click();
  await expect(page.locator("dialog.checkout-dialog")).toBeVisible();

  let orderRequests = 0;
  await page.route("**/api/v1/orders", async (route) => {
    orderRequests += 1;
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({
        code: "SESSION_INVALID",
        message: "Session expired",
        requestId: "test-expired-session",
      }),
    });
  });
  await page.locator(".place-order-button").click();

  await expect(page.locator("dialog.checkout-dialog")).not.toBeVisible();
  await expect(page.locator(".identity-session-expired")).toContainText(
    commercehubModel.messages["identity.sessionExpired"],
  );
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("syntheticSessionToken"))).toBeNull();
  await expect(page.getByRole("button", { name: /Bag 1/ })).toBeVisible();
  expect(orderRequests).toBe(1);

  await page.getByRole("button", { name: commercehubModel.messages["identity.reauthenticate"] }).click();
  await expect(page.getByText(commercehubModel.messages["identity.sessionReady"])).toBeVisible();
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("syntheticSessionToken"))).not.toBe(expiredToken);
  expect(orderRequests).toBe(1);

  await page.getByRole("button", { name: /Bag 1/ }).click();
  await page.getByRole("button", { name: /Continue to checkout/ }).click();
  await expect(page.locator("dialog.checkout-dialog")).toBeVisible();
  await expect(page.locator(".place-order-button")).toBeEnabled();
});
