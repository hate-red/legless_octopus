import { expect, test } from "@playwright/test";

test("draft survives immediate navigation and can be deleted and restored", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "ООО «Ромашка»" }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto("/applications/new");
  const purpose = `Оборудование для разработки ${Date.now()}`;
  await page.getByLabel("На что нужны деньги?").fill(purpose);
  await page
    .getByRole("link", { name: "Мои заявки", exact: true })
    .first()
    .click();
  await expect(page.locator(".request-card").first()).toContainText(purpose);
  await page
    .locator(".request-card")
    .first()
    .getByRole("link", { name: "Продолжить заполнение" })
    .click();
  await expect(page.getByLabel("На что нужны деньги?")).toHaveValue(purpose);
  await page.getByRole("button", { name: "Удалить черновик" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Удалить", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Черновик удалён" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Восстановить", exact: true }).click();
  await expect(page.getByLabel("На что нужны деньги?")).toHaveValue(purpose);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Удалить", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Удалить", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Восстановить", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Восстановить", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Продолжить заявку" }),
  ).toBeVisible();
});

test("bank requests documents, client responds, bank approves", async ({
  page,
  request,
  browser,
}) => {
  await request.post("/api/backend/auth/login", {
    data: { email: "client2@example.com", password: "password123" },
  });
  const applications = await (
    await request.get("/api/backend/applications")
  ).json();
  const template = applications.find(
    (app: { status: string }) => app.status === "MANUAL_REVIEW",
  );
  const draft = await (
    await request.post("/api/backend/applications", {
      data: {
        product_id: template.product.id,
        amount: template.amount,
        term_months: template.term_months,
        purpose: template.purpose,
      },
    })
  ).json();
  const documents = await (
    await request.get("/api/backend/company/documents")
  ).json();
  await request.post(
    `/api/backend/applications/${draft.id}/documents/confirm`,
    { data: { document_ids: documents.map((doc: { id: string }) => doc.id) } },
  );
  expect(
    (
      await (
        await request.post(`/api/backend/applications/${draft.id}/submit`)
      ).json()
    ).status,
  ).toBe("MANUAL_REVIEW");
  await page.goto("/login");
  await page
    .getByRole("button", { name: "Кабинет банка", exact: false })
    .click();
  await expect(page).toHaveURL(/bank\/applications/);
  await page.goto(`/bank/applications/${draft.id}`);
  await page
    .getByRole("button", { name: "Запросить документы", exact: true })
    .click();
  const bankDialog = page.getByRole("dialog");
  await bankDialog
    .getByLabel("Какие данные нужно уточнить?")
    .fill("Обновите финансовую отчётность за последний период");
  await bankDialog
    .getByRole("button", { name: "Отправить запрос", exact: true })
    .click();
  await expect(bankDialog).not.toBeVisible();
  const clientContext = await browser.newContext({
    baseURL: new URL(page.url()).origin,
  });
  const client = await clientContext.newPage();
  try {
    await client.goto("/login");
    await client
      .getByRole("button", { name: "ИП Иванов", exact: false })
      .click();
    await expect(client).toHaveURL(/dashboard/);
    await client.goto(`/applications/${draft.id}`);
    await client
      .getByRole("button", { name: "Предоставить документы", exact: true })
      .click();
    const response = client.getByRole("dialog", {
      name: "Документы для проверки",
    });
    const financeRow = response
      .locator(".document-row")
      .filter({ hasText: "Финансовая отчётность" });
    const chooserPromise = client.waitForEvent("filechooser");
    await financeRow.getByRole("button", { name: "Заменить" }).click();
    const finance = documents.find(
      (doc: { kind: string }) => doc.kind === "finance",
    );
    const pdf = await (
      await request.get(`/api/backend/company/documents/${finance.id}/content`)
    ).body();
    await (
      await chooserPromise
    ).setFiles({
      name: "Обновленная-отчётность.pdf",
      mimeType: "application/pdf",
      buffer: pdf,
    });
    const upload = client.getByRole("dialog", { name: "Обновить документ" });
    await upload
      .getByLabel("Период или дата документа")
      .fill("Последний отчётный период");
    await upload.getByRole("button", { name: "Сохранить документ" }).click();
    await expect(upload).not.toBeVisible();
    await response.getByLabel("Подтверждаю актуальность документов").check();
    await response.getByRole("button", { name: "Отправить документы" }).click();
    await expect(response).not.toBeVisible();
    await expect(
      client.getByRole("button", { name: "Предоставить документы" }),
    ).toHaveCount(0);
    await page.reload();
    await expect(
      page.getByText("Обновленная-отчётность.pdf", { exact: false }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Одобрить", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByLabel("Комментарий для клиента")
      .fill("Документы проверены, финансирование одобрено");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Одобрить заявку" })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.locator(".page-header .status")).toHaveText(
      "Предварительно одобрено",
    );
    await client.reload();
    await expect(
      client.getByRole("button", { name: "Подтвердить условия" }),
    ).toBeVisible();
  } finally {
    await clientContext.close();
  }
});

test("client completes and submits a real application", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/login");
  await page.getByRole("button", { name: "ООО «Ромашка»" }).click();
  await expect(page).toHaveURL(/dashboard/);
  await expect(
    page.getByRole("heading", { name: "Главная", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: ".artifacts/home-light.png", fullPage: true });
  await page
    .getByRole("button", { name: "Свернуть меню", exact: true })
    .click();
  await expect(page.locator(".workspace")).toHaveClass(/is-collapsed/);
  await page
    .getByRole("button", { name: "Развернуть меню", exact: true })
    .click();
  await page.getByRole("button", { name: "Включить тёмную тему" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({ path: ".artifacts/home-dark.png", fullPage: true });
  await page.getByRole("button", { name: "Включить светлую тему" }).click();
  await page
    .getByRole("button", { name: "Помощь", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /^Уведомления/ }).click();
  await expect(
    page.getByRole("heading", { name: "Уведомления", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Новое финансирование" }).click();
  await page
    .getByLabel("На что нужны деньги?")
    .fill("Закупка серверов для разработки программного обеспечения");
  await page.getByLabel("Какая сумма нужна?").fill("500000");
  await page.getByRole("button", { name: "К документам" }).click();
  await expect(
    page.getByRole("heading", { name: "Документы компании", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Подтверждаю, что перечисленные документы актуальны")
    .check();
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Проверьте заявку" }),
  ).toBeVisible();
  await page
    .getByLabel("Подтверждаю сведения и согласен на проверку данных компании")
    .check();
  await page
    .getByRole("button", { name: "Получить оценку", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Результат оценки", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".score-value strong").first()).toHaveText(/\d+/);
  await page.screenshot({
    path: ".artifacts/result-light.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "К заявкам", exact: true }).click();
  await expect(page.locator(".request-card").first()).toContainText(
    "Закупка серверов",
  );
  await page.goto("/profile");
  await page.getByRole("tab", { name: "Документы", exact: true }).click();
  await expect(page.locator(".document-row")).toHaveCount(3);
  await page.getByRole("tab", { name: "О компании" }).click();
  await page.screenshot({
    path: ".artifacts/company-light.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/applications");
  await expect(page.locator(".request-card").first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: ".artifacts/applications-mobile.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("login by INN and bank queue filters work", async ({ page, request }) => {
  const login = await request.post("/api/backend/auth/login", {
    data: { email: "client1@example.com", password: "password123" },
  });
  const { user } = await login.json();
  await request.post("/api/backend/auth/logout");
  await page.goto("/login");
  await page.getByRole("button", { name: "Войти по ИНН", exact: true }).click();
  await page.getByLabel("ИНН компании").fill(user.company.inn);
  await page.getByLabel("Пароль", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto("/profile");
  await page.getByRole("button", { name: "Выйти из кабинета" }).click();
  await expect(page).toHaveURL(/login/);
  await page
    .getByRole("button", { name: "Кабинет банка", exact: false })
    .click();
  await expect(page).toHaveURL(/bank\/applications/);
  await expect(page.locator(".bank-queue-row").first()).toBeVisible();
  await page
    .getByRole("combobox", { name: "Статус заявки" })
    .selectOption("MANUAL_REVIEW");
  await expect(page.locator(".loading")).toHaveCount(0);
  await expect(page.locator(".bank-queue-row").first()).toContainText(
    "Дополнительная проверка",
  );
  await page
    .locator(".bank-queue-row")
    .first()

    .click();
  await expect(
    page.getByRole("heading", { name: "Что делаем дальше?" }),
  ).toBeVisible();
  await page.screenshot({ path: ".artifacts/bank-review.png", fullPage: true });
});
