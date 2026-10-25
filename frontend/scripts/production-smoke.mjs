/* Read-only browser and API checks against a running production build. */
import { chromium, request } from "@playwright/test";
const baseURL = process.env.SMOKE_BASE_URL || "http://localhost:3000";
(async () => {
  const browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    headless: true,
  });
  const failures = [];
  try {
    const anonymous = await request.newContext({ baseURL });
    if ((await anonymous.get("/api/backend/auth/me")).status() !== 401)
      failures.push("Anonymous API access");
    for (const path of ["login", "logout"]) {
      const response = await anonymous.post(`/api/backend/auth/${path}`, {
        headers: { Origin: "https://untrusted.example" },
        data: { email: "client1@example.com", password: "password123" },
      });
      if (response.status() !== 403) failures.push(`Foreign Origin: ${path}`);
    }
    await anonymous.dispose();
    for (const [label, button, routes] of [
      [
        "client",
        "ООО «Ромашка»",
        ["/dashboard", "/applications/new", "/applications", "/profile"],
      ],
      ["bank", "Кабинет банка", ["/bank/applications", "/bank/decisions"]],
    ]) {
      const context = await browser.newContext({
        baseURL,
        viewport: { width: 1280, height: 920 },
      });
      const page = await context.newPage();
      page.on("pageerror", (error) =>
        failures.push(`${label}: ${error.message}`),
      );
      await page.goto("/login");
      await page.getByRole("button", { name: button, exact: false }).click();
      await page.waitForURL(
        label === "bank" ? "**/bank/applications" : "**/dashboard",
      );
      await page.locator(".main-content h1").waitFor();
      const session = await context.request.get("/api/backend/auth/me");
      if (
        !session.ok() ||
        !session.headers()["cache-control"]?.includes("no-store")
      )
        failures.push(`${label}: session caching`);
      const cookie = (await context.cookies()).find(
        (cookie) => cookie.name === "credit_session",
      );
      if (!cookie?.httpOnly) failures.push(`${label}: cookie is not HttpOnly`);
      const list = await (
        await context.request.get(
          `/api/backend/${label === "bank" ? "bank/" : ""}applications`,
        )
      ).json();
      const detail = list.find((app) => app.status !== "DRAFT");
      if (detail)
        routes.push(
          `${label === "bank" ? "/bank" : ""}/applications/${detail.id}`,
        );
      for (const route of routes) {
        await page.goto(route);
        await page.locator(".main-content h1").waitFor();
        await page.locator(".loading").waitFor({ state: "hidden" });
        for (const theme of ["light", "dark"]) {
          const attribute = await page
            .locator("html")
            .getAttribute("data-theme");
          if (attribute !== theme)
            await page
              .getByRole("button", {
                name:
                  theme === "dark"
                    ? "Включить тёмную тему"
                    : "Включить светлую тему",
              })
              .click();
          for (const width of [1280, 1024, 736, 390, 320]) {
            await page.setViewportSize({ width, height: 920 });
            await page.waitForTimeout(80);
            if (
              await page.evaluate(
                () => document.documentElement.scrollWidth > innerWidth,
              )
            )
              failures.push(`Overflow ${route} ${theme} ${width}`);
          }
        }
        await page.setViewportSize({ width: 1280, height: 920 });
        await page
          .getByRole("button", { name: "Включить светлую тему" })
          .click();
        await page.waitForTimeout(200);
        await page.screenshot({
          path: `.artifacts/production${route.replaceAll("/", "-")}.png`,
          fullPage: true,
        });
      }
      if (label === "client") {
        const docs = await (
          await context.request.get("/api/backend/company/documents")
        ).json();
        if (docs.length) {
          const pdf = await context.request.get(
            `/api/backend/company/documents/${docs[0].id}/content`,
          );
          if (
            !pdf.ok() ||
            !(await pdf.body()).subarray(0, 5).equals(Buffer.from("%PDF-"))
          )
            failures.push("PDF download");
        }
      }
      await context.close();
      console.log(
        `${label}: login, API, routes, themes and 5 viewport widths checked`,
      );
    }
  } finally {
    await browser.close();
  }
  if (failures.length) {
    console.error(failures.join("\n"));
    process.exitCode = 1;
  } else console.log("Production smoke checks passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
