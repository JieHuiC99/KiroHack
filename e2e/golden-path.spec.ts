import { expect, test } from "@playwright/test";

// Mirrors the 90-second demo: alarm → wheelchair user asks for help → responder accepts →
// evacuated. Three browser contexts stand in for the dashboard laptop and two phones.
test("wheelchair user gets help during a fire alarm", async ({ browser, request }) => {
  await request.post("/api/emergency", { data: { action: "end" } }); // clean slate

  const dashboard = await (await browser.newContext()).newPage();
  const student = await (await browser.newContext()).newPage();
  const responder = await (await browser.newContext()).newPage();

  await student.goto("/me");
  await student.getByLabel("Your name").fill("Aisha");
  await student.getByLabel(/wheelchair/).check();
  await student.getByLabel(/Room you are usually in/).selectOption({ label: "UC-3-3" });
  await student.getByRole("button", { name: "Save" }).click();
  await expect(student.getByText("No emergency right now.")).toBeVisible();

  await responder.goto("/responder");
  await responder.getByLabel("Your name").fill("Ben");
  await responder.getByRole("button", { name: "Continue" }).click();

  await dashboard.goto("/dashboard");
  await dashboard.getByRole("button", { name: /Simulate fire alarm/ }).click();
  await expect(dashboard.getByText(/FIRE EMERGENCY ACTIVE/)).toBeVisible();

  await expect(student.getByRole("heading", { name: /FIRE EMERGENCY/ })).toBeVisible();
  await student.getByRole("button", { name: "I need help" }).click();
  await expect(student.getByText(/Help requested/).first()).toBeVisible();

  await responder.getByRole("button", { name: /Accept/ }).click();
  await expect(student.getByText(/Ben has accepted/)).toBeVisible();
  await expect(dashboard.getByText("Accepted by Ben")).toBeVisible();

  await responder.getByRole("button", { name: /Mark Aisha as evacuated/ }).click();
  await expect(dashboard.getByText("Resolved — evacuated")).toBeVisible();

  await dashboard.getByRole("button", { name: /End emergency/ }).click();
  await expect(student.getByText("No emergency right now.")).toBeVisible();
});
